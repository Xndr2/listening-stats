# Listening Stats  -  install or update for Spicetify (Windows).
# Usage:
#   irm https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.ps1 | iex
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

Write-Banner

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

$spicetify = Get-Command spicetify -ErrorAction SilentlyContinue
if (-not $spicetify) {
    Write-Host ""
    Write-Host "! spicetify not found in PATH. Install Spicetify CLI, then run:" -ForegroundColor Yellow
    Write-Host "  spicetify config custom_apps listening-stats; spicetify apply"
    exit 1
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
