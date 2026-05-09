# Listening Stats  -  install or update for Spicetify (Windows).
# Usage:
#   irm https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.ps1 | iex
#
# If Spicetify CLI is missing, installs it under LocalAppData\spicetify (non-interactive; no Marketplace).
# Set $env:LISTENING_STATS_SKIP_SPICETIFY_INSTALL = "1" to only install LS (fail if spicetify missing).
#
# Downloads listening-stats.zip from GitHub Releases (default: latest stable). With
# $env:LISTENING_STATS_PRERELEASE = "1", uses the newest release that ships listening-stats.zip.
#
# Replaces CustomApps/listening-stats, runs spicetify apply, removes temp files.

$ErrorActionPreference = "Stop"

$RepoSlug = "Xndr2/listening-stats"
$MinZipBytes = 2000

function Resolve-ZipUrl {
    param([string]$Slug)
    if ($env:LISTENING_STATS_PRERELEASE -eq "1") {
        $uri = "https://api.github.com/repos/$Slug/releases?per_page=20"
        $releases = @(Invoke-RestMethod -Uri $uri -Headers @{ Accept = "application/vnd.github+json" })
        foreach ($rel in $releases) {
            $names = @($rel.assets | ForEach-Object { $_.name })
            if ($names -contains "listening-stats.zip") {
                $tag = $rel.tag_name
                return "https://github.com/$Slug/releases/download/$tag/listening-stats.zip"
            }
        }
        throw "No GitHub release includes listening-stats.zip."
    }
    return "https://github.com/$Slug/releases/latest/download/listening-stats.zip"
}

function Write-Rule {
    Write-Host ("─" * 64) -ForegroundColor DarkGray
}

function Write-Banner {
    Write-Host ""
    Write-Rule
    Write-Host "  Listening Stats " -NoNewline -ForegroundColor Cyan
    Write-Host "· " -NoNewline -ForegroundColor DarkGray
    Write-Host "install / update" -ForegroundColor White
    Write-Host "  Spicetify custom app" -ForegroundColor DarkGray
    Write-Rule
    Write-Host ""
}

function Step($Message) {
    Write-Host "▸ " -NoNewline -ForegroundColor Green
    Write-Host $Message -ForegroundColor White
}

function Ensure-SpicetifyCli {
    if ($env:LISTENING_STATS_SKIP_SPICETIFY_INSTALL -eq "1") {
        if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
            throw "spicetify not found and LISTENING_STATS_SKIP_SPICETIFY_INSTALL=1."
        }
        return
    }

    if (Get-Command spicetify -ErrorAction SilentlyContinue) {
        return
    }

    $spicetifyDir = Join-Path $env:LOCALAPPDATA "spicetify"
    $spicetifyExe = Join-Path $spicetifyDir "spicetify.exe"
    if (Test-Path $spicetifyExe) {
        $env:PATH = "$spicetifyDir;$env:PATH"
        if (Get-Command spicetify -ErrorAction SilentlyContinue) { return }
    }

    if ($PSVersionTable.PSVersion -lt [version]'5.1') {
        throw "PowerShell 5.1+ is required to install Spicetify automatically. See https://spicetify.app/docs/getting-started"
    }

    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this installer from a non-elevated PowerShell window (Spicetify installs per-user)."
    }

    Step "Installing Spicetify CLI (first-time, non-interactive)"

    if ($env:PROCESSOR_ARCHITECTURE -eq 'AMD64') { $arch = 'x64' }
    elseif ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { $arch = 'arm64' }
    else { $arch = 'x32' }

    $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/spicetify/cli/releases/latest' -Headers @{ Accept = 'application/vnd.github+json' }
    $ver = ($rel.tag_name -replace '^v', '')
    $spZipUrl = "https://github.com/spicetify/cli/releases/download/v$ver/spicetify-$ver-windows-$arch.zip"
    $spTmpZip = Join-Path $env:TEMP "spicetify-cli-$([guid]::NewGuid().ToString('N')).zip"

    try {
        Invoke-WebRequest -Uri $spZipUrl -OutFile $spTmpZip -UseBasicParsing
        New-Item -ItemType Directory -Force -Path $spicetifyDir | Out-Null
        Expand-Archive -Path $spTmpZip -DestinationPath $spicetifyDir -Force
    }
    finally {
        Remove-Item -Force $spTmpZip -ErrorAction SilentlyContinue
    }

    $userScope = [EnvironmentVariableTarget]::User
    $pathVal = [Environment]::GetEnvironmentVariable('PATH', $userScope)
    if ([string]::IsNullOrEmpty($pathVal)) {
        [Environment]::SetEnvironmentVariable('PATH', $spicetifyDir, $userScope)
    }
    elseif ($pathVal -notlike "*$spicetifyDir*") {
        [Environment]::SetEnvironmentVariable('PATH', "$pathVal;$spicetifyDir", $userScope)
    }
    $env:PATH = "$spicetifyDir;$env:PATH"

    if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
        throw "Spicetify installed but spicetify was not found on PATH. Close this window, open a new PowerShell, and run the installer again."
    }

    Write-Host "   Spicetify v$ver  -  $spicetifyExe" -ForegroundColor DarkGray
}

Write-Banner

Ensure-SpicetifyCli

$ZipUrl = Resolve-ZipUrl -Slug $RepoSlug

$TmpZip = Join-Path $env:TEMP "listening-stats-$([guid]::NewGuid().ToString('N')).zip"
$ExtractRoot = Join-Path $env:TEMP "listening-stats-extract-$([guid]::NewGuid().ToString('N'))"

$CustomApps = $null
$spicetifyEarly = Get-Command spicetify -ErrorAction SilentlyContinue
if ($spicetifyEarly) {
    try {
        $capps = (& spicetify -q -a path root 2>$null)
        if (-not $capps) { $capps = (& spicetify -a path root 2>$null) }
        $capps = if ($capps) { (($capps | Out-String).Trim() -split "`n")[0].Trim() } else { "" }
        if ($capps -and (Test-Path $capps)) {
            $CustomApps = $capps
        }
        else {
            $ud = (& spicetify -q path userdata 2>$null)
            if (-not $ud) { $ud = (& spicetify path userdata 2>$null) }
            $ud = if ($ud) { ($ud | Out-String).Trim() } else { "" }
            if ($ud -and (Test-Path $ud)) {
                $CustomApps = Join-Path $ud "CustomApps"
            }
        }
    }
    catch { }
}
if (-not $CustomApps) {
    $CustomApps = Join-Path $env:APPDATA "spicetify\CustomApps"
}

$Dest = Join-Path $CustomApps "listening-stats"

try {
    Step "Downloading"
    Write-Host "   $ZipUrl" -ForegroundColor DarkGray
    Invoke-WebRequest -Uri $ZipUrl -OutFile $TmpZip -UseBasicParsing

    $len = (Get-Item $TmpZip).Length
    if ($len -lt $MinZipBytes) {
        throw "Download is too small ($len bytes)  -  expected a real release zip."
    }

    Step "Extracting"
    New-Item -ItemType Directory -Force -Path $ExtractRoot | Out-Null
    Expand-Archive -Path $TmpZip -DestinationPath $ExtractRoot -Force

    $Inner = Join-Path $ExtractRoot "listening-stats"
    $manifestAtRoot = Test-Path (Join-Path $ExtractRoot "manifest.json")
    $indexAtRoot = Test-Path (Join-Path $ExtractRoot "index.js")

    Step "Installing"
    Write-Host "   → $Dest" -ForegroundColor DarkGray
    New-Item -ItemType Directory -Force -Path $CustomApps | Out-Null
    if (Test-Path $Dest) {
        Remove-Item -Recurse -Force $Dest
    }

    # Always end up at CustomApps/listening-stats  -  never leave loose files in CustomApps.
    if (Test-Path $Inner) {
        Move-Item -Path $Inner -Destination $Dest
    }
    elseif ($manifestAtRoot -or $indexAtRoot) {
        New-Item -ItemType Directory -Force -Path $Dest | Out-Null
        Get-ChildItem -Path $ExtractRoot -Force | Move-Item -Destination $Dest
    }
    else {
        $dirs = @(Get-ChildItem -Path $ExtractRoot -Directory -Force)
        if ($dirs.Count -eq 1) {
            $sole = $dirs[0].FullName
            if ((Test-Path (Join-Path $sole "manifest.json")) -or (Test-Path (Join-Path $sole "index.js"))) {
                Move-Item -Path $sole -Destination $Dest
            }
            else {
                throw "Zip layout not recognized (single folder without manifest.json / index.js)."
            }
        }
        else {
            throw "Zip layout not recognized. Expected listening-stats/, files at zip root, or one app folder."
        }
    }

    if (-not (Test-Path (Join-Path $Dest "manifest.json"))) {
        throw "Installed folder is missing manifest.json  -  zip may be wrong or corrupt."
    }
}
finally {
    Remove-Item -Force $TmpZip -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $ExtractRoot -ErrorAction SilentlyContinue
}

Step "Applying Spicetify (config + apply)"
spicetify config custom_apps listening-stats
spicetify apply

Write-Host ""
Write-Rule
Write-Host "Done. " -NoNewline -ForegroundColor Green
Write-Host "Restart Spotify if the app does not pick up changes."
Write-Rule
Write-Host ""
