# Listening Stats  -  install or update for Spicetify (Windows).
# Usage:
#   irm https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.ps1 | iex
#
# If Spicetify CLI is missing, installs it under LocalAppData\spicetify (non-interactive; no Marketplace).
# Set $env:LISTENING_STATS_SKIP_SPICETIFY_INSTALL = "1" to only install LS (fail if spicetify missing).
#
# Downloads listening-stats.zip from GitHub Releases (default: latest stable). Stable builds
# resolve the real asset URL from the API (avoids stale proxies caching /releases/latest/download/…).
# Fallback: https://github.com/<repo>/releases/latest/download/listening-stats.zip (GitHub does not
# serve …/releases/latest/listening-stats.zip — that path 404s). With
# $env:LISTENING_STATS_PRERELEASE = "1", uses the newest release that ships listening-stats.zip.
#
# Installs into the **user-config** CustomApps directory (where `spicetify apply` reads from
# first), then wipes any stale `listening-stats` copies in the CLI exe-dir CustomApps and any
# Spicetify-resolved path so the loader cannot pick up an old version. Auto-recovers from a
# stale backup ("Preprocessed Spotify data is outdated") by chaining `spicetify backup apply`.

$ErrorActionPreference = "Stop"
# Force UTF-8 console output so box-drawing / Unicode glyphs from spicetify and this script do
# not get re-encoded to "?" on Windows PowerShell 5.1 (default OEM codepage). Best-effort.
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }
# We invoke spicetify via & and inspect $LASTEXITCODE manually, so we MUST keep
# $PSNativeCommandUseErrorActionPreference disabled — otherwise PS 7.3+ throws on every
# non-zero exit (including expected ones during recovery) and the script aborts.
try { $PSNativeCommandUseErrorActionPreference = $false } catch { }

$RepoSlug = "Xndr2/listening-stats"
$AppName = "listening-stats"
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
    $apiLatest = "https://api.github.com/repos/$Slug/releases/latest"
    try {
        $rel = Invoke-RestMethod -Uri $apiLatest -Headers @{ Accept = "application/vnd.github+json" } -ErrorAction Stop
    }
    catch {
        $nonce = [guid]::NewGuid().ToString("N")
        return "https://github.com/$Slug/releases/latest/download/listening-stats.zip?t=$nonce"
    }
    $match = @($rel.assets | Where-Object { $_.name -eq "listening-stats.zip" })
    if ($match.Count -lt 1) {
        throw "Latest GitHub release has no listening-stats.zip asset."
    }
    return $match[0].browser_download_url
}

function Write-Rule {
    Write-Host ("-" * 64) -ForegroundColor DarkGray
}

function Write-Banner {
    Write-Host ""
    Write-Rule
    Write-Host "  Listening Stats " -NoNewline -ForegroundColor Cyan
    Write-Host "- " -NoNewline -ForegroundColor DarkGray
    Write-Host "install / update" -ForegroundColor White
    Write-Host "  Spicetify custom app" -ForegroundColor DarkGray
    Write-Rule
    Write-Host ""
}

function Step($Message) {
    Write-Host "> " -NoNewline -ForegroundColor Green
    Write-Host $Message -ForegroundColor White
}

function Detail($Message) {
    Write-Host "   $Message" -ForegroundColor DarkGray
}

function Warn($Message) {
    Write-Host "   $Message" -ForegroundColor Yellow
}

function Invoke-Spicetify {
    param([string[]]$ArgumentList)
    # Defensively disable both knobs that turn native non-zero exits into terminating errors —
    # we want to *inspect* $LASTEXITCODE, not crash on it.
    $PSNativeCommandUseErrorActionPreference = $false
    $eapPrev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = ''
    $code = 0
    try {
        $out = (& spicetify @ArgumentList 2>&1 | Out-String)
        $code = $LASTEXITCODE
    }
    catch {
        # Should be unreachable now, but if a host still escalates the native call we keep the
        # message and report a non-zero exit instead of bubbling the exception up.
        $out = $_.Exception.Message
        $code = if ($LASTEXITCODE) { $LASTEXITCODE } else { 1 }
    }
    finally {
        $ErrorActionPreference = $eapPrev
    }
    return [pscustomobject]@{
        ExitCode = $code
        Output   = $out.Trim()
    }
}

function Get-SpicetifyPath {
    param([Parameter(Mandatory)][string[]]$ArgumentList)
    $res = Invoke-Spicetify -ArgumentList $ArgumentList
    if ($res.ExitCode -ne 0) { return "" }
    if ([string]::IsNullOrWhiteSpace($res.Output)) { return "" }
    return ($res.Output -split "`n")[0].Trim()
}

function Resolve-UserConfigCustomAppsDir {
    # Where `spicetify apply` looks for custom apps FIRST (see src/utils/path-utils.go GetCustomAppPath).
    # 1. SPICETIFY_CONFIG env var if set
    # 2. parent of `spicetify path -c` (config-xpui.ini) — authoritative when CLI is on PATH
    # 3. %APPDATA%\spicetify (Windows default in src/utils/path-utils.go GetSpicetifyFolder)
    if ($env:SPICETIFY_CONFIG -and (Test-Path $env:SPICETIFY_CONFIG)) {
        return Join-Path $env:SPICETIFY_CONFIG "CustomApps"
    }
    if (Get-Command spicetify -ErrorAction SilentlyContinue) {
        $cfgIni = Get-SpicetifyPath -ArgumentList @('path', '-c')
        if ($cfgIni -and (Test-Path $cfgIni)) {
            return Join-Path (Split-Path -Parent $cfgIni) "CustomApps"
        }
    }
    return Join-Path $env:APPDATA "spicetify\CustomApps"
}

function Resolve-ExeDirCustomAppsDir {
    # The CLI's bundled CustomApps root (used as a *fallback* by GetCustomAppPath when the
    # user-config dir does not contain the app). We only want to *clean* this location.
    if (Get-Command spicetify -ErrorAction SilentlyContinue) {
        $exePath = Get-SpicetifyPath -ArgumentList @('path')
        if ($exePath -and (Test-Path $exePath)) {
            $exeDir = Split-Path -Parent $exePath
            return Join-Path $exeDir "CustomApps"
        }
        $alt = Get-SpicetifyPath -ArgumentList @('path', '-a', 'root')
        if ($alt -and (Test-Path $alt)) {
            return $alt
        }
    }
    return $null
}

function Resolve-SpicetifyResolvedAppDir {
    # Whatever path `spicetify path -a <name>` returns — accounts for env-var overrides and any
    # quirky resolution. Empty if not currently installed.
    param([string]$Name)
    if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) { return $null }
    $p = Get-SpicetifyPath -ArgumentList @('path', '-a', $Name)
    if ($p -and (Test-Path $p)) { return $p }
    return $null
}

function Remove-AppDirSafe {
    param([string]$Path, [string]$Label)
    if (-not $Path) { return }
    if (-not (Test-Path -LiteralPath $Path)) { return }
    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        Detail "removed $Label : $Path"
    }
    catch {
        Warn "could not remove $Label at $Path  -  $($_.Exception.Message)"
        Warn "If Spotify is running, close it (and any Spotify tray icon) and re-run the installer."
        throw
    }
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

    Detail "Spicetify v$ver  -  $spicetifyExe"
}

function Confirm-NoNestedAppLayout {
    # Defensive: spicetify's GetCustomAppSubfolderPath recursively walks the install dir and
    # returns the FIRST subfolder containing index.js, which would hijack the loader. After a
    # fresh install, manifest.json + index.js live at the top level only, but a botched user
    # state might leave a nested copy. Detect and surface so the user knows what was wiped.
    param([string]$AppDir)
    $hits = @(Get-ChildItem -LiteralPath $AppDir -Directory -Recurse -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "index.js") })
    if ($hits.Count -gt 0) {
        foreach ($h in $hits) {
            Warn "stale nested index.js detected at $($h.FullName)  -  removing"
            Remove-Item -LiteralPath $h.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Invoke-SpicetifyApplyWithRecovery {
    Step "Applying Spicetify (config + apply)"
    $cfg = Invoke-Spicetify -ArgumentList @('config', 'custom_apps', $AppName)
    if ($cfg.ExitCode -ne 0) {
        Warn $cfg.Output
        throw "spicetify config failed (exit $($cfg.ExitCode))."
    }

    $apply = Invoke-Spicetify -ArgumentList @('apply')
    $needsRebackup = ($apply.ExitCode -ne 0) -or
                     ($apply.Output -match '(?i)outdated|mismatch|backup apply|restore backup apply')

    if (-not $needsRebackup) {
        return
    }

    Warn "spicetify apply reported a stale-backup or version-mismatch state:"
    if ($apply.Output) { Warn ($apply.Output -replace '^', '   ') }
    Step "Auto-recovery: spicetify backup apply"
    $rec = Invoke-Spicetify -ArgumentList @('backup', 'apply')
    if ($rec.ExitCode -eq 0) {
        return
    }

    Warn "backup apply failed; trying restore + backup + apply"
    if ($rec.Output) { Warn ($rec.Output -replace '^', '   ') }
    $rec2 = Invoke-Spicetify -ArgumentList @('restore', 'backup', 'apply')
    if ($rec2.ExitCode -eq 0) {
        return
    }

    if ($rec2.Output) { Warn ($rec2.Output -replace '^', '   ') }
    throw "Could not auto-recover spicetify state. Close Spotify completely (incl. tray icon) and run: spicetify restore backup apply"
}

Write-Banner

Ensure-SpicetifyCli

$ZipUrl = Resolve-ZipUrl -Slug $RepoSlug

$TmpZip = Join-Path $env:TEMP "listening-stats-$([guid]::NewGuid().ToString('N')).zip"
$ExtractRoot = Join-Path $env:TEMP "listening-stats-extract-$([guid]::NewGuid().ToString('N'))"

Step "Locating Spicetify CustomApps"
$UserCustomApps = Resolve-UserConfigCustomAppsDir
$ExeCustomApps = Resolve-ExeDirCustomAppsDir
Detail "user-config (install target) : $UserCustomApps"
if ($ExeCustomApps -and ($ExeCustomApps -ne $UserCustomApps)) {
    Detail "exe-dir (cleanup only)        : $ExeCustomApps"
}

$Dest = Join-Path $UserCustomApps $AppName

# Cleanup pass: remove every place a stale listening-stats could live so the loader can't pick
# an old copy. Spicetify resolves at apply time via GetCustomAppPath: user-config first, then
# exe-dir. We wipe both, plus whatever the CLI currently *thinks* the path is.
Step "Removing any prior listening-stats copies"
$resolved = Resolve-SpicetifyResolvedAppDir -Name $AppName
$cleanupTargets = @($Dest)
if ($ExeCustomApps) { $cleanupTargets += (Join-Path $ExeCustomApps $AppName) }
if ($resolved)      { $cleanupTargets += $resolved }
$cleanupTargets = $cleanupTargets | Sort-Object -Unique

foreach ($t in $cleanupTargets) {
    Remove-AppDirSafe -Path $t -Label "$AppName"
}

try {
    Step "Downloading"
    Detail $ZipUrl
    Invoke-WebRequest -Uri $ZipUrl -OutFile $TmpZip -UseBasicParsing -Headers @{
        "Cache-Control" = "no-cache"
        "Pragma"        = "no-cache"
    }

    $len = (Get-Item $TmpZip).Length
    if ($len -lt $MinZipBytes) {
        throw "Download is too small ($len bytes)  -  expected a real release zip."
    }

    Step "Extracting"
    New-Item -ItemType Directory -Force -Path $ExtractRoot | Out-Null
    Expand-Archive -Path $TmpZip -DestinationPath $ExtractRoot -Force

    $Inner = Join-Path $ExtractRoot $AppName
    $manifestAtRoot = Test-Path (Join-Path $ExtractRoot "manifest.json")
    $indexAtRoot = Test-Path (Join-Path $ExtractRoot "index.js")

    Step "Installing"
    Detail "-> $Dest"
    New-Item -ItemType Directory -Force -Path $UserCustomApps | Out-Null

    # Always end up at <UserCustomApps>/listening-stats  -  never leave loose files in CustomApps.
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

    Confirm-NoNestedAppLayout -AppDir $Dest
}
finally {
    Remove-Item -Force $TmpZip -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $ExtractRoot -ErrorAction SilentlyContinue
}

Invoke-SpicetifyApplyWithRecovery

Write-Host ""
Write-Rule
Write-Host "Done. " -NoNewline -ForegroundColor Green
Write-Host "Restart Spotify if the app does not pick up changes."
Write-Rule
Write-Host ""
