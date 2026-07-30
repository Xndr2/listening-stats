# Listening Stats  -  install or update for Spicetify (Windows).
# Usage:
#   irm https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.ps1 | iex
#
# If Spicetify CLI is missing, installs it under LocalAppData\spicetify (non-interactive; no Marketplace).
# Set $env:LISTENING_STATS_SKIP_SPICETIFY_INSTALL = "1" to only install LS (fail if spicetify missing).
#
# Downloads listening-stats.zip from GitHub Releases (default: latest stable; prereleases are
# always skipped). Stable builds resolve the real asset URL from the API (avoids stale proxies
# caching /releases/latest/download/…). Fallback:
# https://github.com/<repo>/releases/latest/download/listening-stats.zip (GitHub does not
# serve …/releases/latest/listening-stats.zip — that path 404s). With
# $env:LISTENING_STATS_PRERELEASE = "1", a prerelease is installed only when its version is
# newer than the newest stable release — otherwise the stable release still wins.
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

function Get-ReleaseCoreVersion {
    # Numeric core of a release tag ("v2.1.0-beta.1" -> [version]2.1.0) for ordering.
    param($Release)
    $v = "$($Release.tag_name)" -replace '^[vV]', ''
    $v = ($v -split '[-+]')[0]
    try { return [version]$v } catch { return $null }
}

function Resolve-ZipUrl {
    param([string]$Slug)
    if ($env:LISTENING_STATS_PRERELEASE -eq "1") {
        # A prerelease is only picked when its version is strictly newer than the
        # newest stable release (stable 2.1.0 beats its own 2.1.0-beta.N); otherwise
        # the stable release wins, so the flag is safe even with no prereleases yet.
        $uri = "https://api.github.com/repos/$Slug/releases?per_page=20"
        $releases = @(Invoke-RestMethod -Uri $uri -Headers @{ Accept = "application/vnd.github+json" })
        $withZip = @($releases | Where-Object {
            -not $_.draft -and (@($_.assets | ForEach-Object { $_.name }) -contains "listening-stats.zip")
        })
        $stable = @($withZip | Where-Object { -not $_.prerelease }) | Select-Object -First 1
        $prerel = @($withZip | Where-Object { $_.prerelease }) | Select-Object -First 1
        $pick = $stable
        if ($prerel) {
            if (-not $stable) {
                $pick = $prerel
            }
            else {
                $sv = Get-ReleaseCoreVersion $stable
                $pv = Get-ReleaseCoreVersion $prerel
                if ($sv -and $pv -and $pv -gt $sv) { $pick = $prerel }
            }
        }
        if (-not $pick) {
            throw "No GitHub release includes listening-stats.zip."
        }
        return "https://github.com/$Slug/releases/download/$($pick.tag_name)/listening-stats.zip"
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

function Test-PathSafe {
    # Test-Path throws "Illegal characters in path" on Windows when given a string with control
    # bytes (e.g. ANSI escapes leaking from spicetify) or characters in <>:"|?*. We never want
    # diagnostic-string handling to crash the installer, so swallow that into $false.
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    try { return [bool](Test-Path -LiteralPath $Path) }
    catch { return $false }
}

function Remove-TemporaryPath {
    # Temporary cleanup must never turn an otherwise successful install into a failure.
    # Use LiteralPath so usernames or temp directories containing wildcard characters are
    # handled as exact paths, and tolerate stale/invalid short-path aliases reported by some
    # Windows PowerShell environments.
    param([string]$Path, [switch]$Recurse)
    if (-not (Test-PathSafe $Path)) { return }

    try {
        $params = @{
            LiteralPath = $Path
            Force       = $true
            ErrorAction = 'Stop'
        }
        if ($Recurse) { $params.Recurse = $true }
        Remove-Item @params
    }
    catch {
        Warn "could not remove temporary path at $Path  -  $($_.Exception.Message)"
    }
}

function Get-SpicetifyPath {
    param([Parameter(Mandatory)][string[]]$ArgumentList)
    $res = Invoke-Spicetify -ArgumentList $ArgumentList
    if ($res.ExitCode -ne 0) { return "" }
    if ([string]::IsNullOrWhiteSpace($res.Output)) { return "" }
    # Strip ANSI CSI sequences (ESC [ … final-byte) — spicetify emits them on Windows hosts that
    # advertise VT support, and the ESC byte (0x1B) is illegal in Windows paths -> Test-Path
    # throws unless we sanitize first.
    $clean = [regex]::Replace($res.Output, "`e\[[0-9;]*[A-Za-z]", "")
    # Drop any remaining control bytes (CR is preserved across split below; we strip everything
    # else 0x00-0x1F that survived).
    $clean = [regex]::Replace($clean, "[\x00-\x08\x0B\x0C\x0E-\x1F]", "")
    foreach ($raw in ($clean -split "`r?`n")) {
        $line = $raw.Trim()
        if (-not $line) { continue }
        # Skip lines that are obviously banners/warnings/info, not paths. spicetify on first
        # run (fresh install) prints version + initialization messages above the actual path.
        if ($line -match '^(\s*)(spicetify\s+v|warning|info|error|note|please)\b') { continue }
        return $line
    }
    return ""
}

function Get-SpicetifyExeDir {
    # Pure PowerShell-native lookup so no spicetify output parsing is needed. (Get-Command
    # spicetify).Source returns the resolved .exe path on Windows and the binary path on
    # Unix; either way Split-Path gives us the install directory whose CustomApps subfolder
    # is the CLI's bundled fallback location.
    $cmd = Get-Command spicetify -ErrorAction SilentlyContinue
    if (-not $cmd) { return $null }
    $src = $cmd.Source
    if (-not $src) { return $null }
    if (-not (Test-PathSafe $src)) { return $null }
    return Split-Path -Parent $src
}

function Resolve-UserConfigCustomAppsDir {
    # Where `spicetify apply` looks for custom apps FIRST (see src/utils/path-utils.go GetCustomAppPath).
    # 1. SPICETIFY_CONFIG env var if set
    # 2. parent of `spicetify path -c` (config-xpui.ini) — authoritative when CLI is on PATH
    # 3. %APPDATA%\spicetify (Windows default in src/utils/path-utils.go GetSpicetifyFolder)
    if ($env:SPICETIFY_CONFIG -and (Test-PathSafe $env:SPICETIFY_CONFIG)) {
        return Join-Path $env:SPICETIFY_CONFIG "CustomApps"
    }
    if (Get-Command spicetify -ErrorAction SilentlyContinue) {
        $cfgIni = Get-SpicetifyPath -ArgumentList @('path', '-c')
        if ($cfgIni -and (Test-PathSafe $cfgIni)) {
            return Join-Path (Split-Path -Parent $cfgIni) "CustomApps"
        }
    }
    return Join-Path $env:APPDATA "spicetify\CustomApps"
}

function Resolve-ExeDirCustomAppsDir {
    # The CLI's bundled CustomApps root (used as a *fallback* by GetCustomAppPath when the
    # user-config dir does not contain the app). We only want to *clean* this location.
    $exeDir = Get-SpicetifyExeDir
    if ($exeDir) {
        return Join-Path $exeDir "CustomApps"
    }
    return $null
}

function Resolve-SpicetifyResolvedAppDir {
    # Whatever path `spicetify path -a <name>` returns — accounts for env-var overrides and any
    # quirky resolution. Empty if not currently installed.
    param([string]$Name)
    if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) { return $null }
    $p = Get-SpicetifyPath -ArgumentList @('path', '-a', $Name)
    if ($p -and (Test-PathSafe $p)) { return $p }
    return $null
}

function Remove-AppDirSafe {
    param([string]$Path, [string]$Label)
    if (-not $Path) { return }
    if (-not (Test-PathSafe $Path)) { return }
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
        Remove-TemporaryPath -Path $spTmpZip
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
    Remove-TemporaryPath -Path $TmpZip
    Remove-TemporaryPath -Path $ExtractRoot -Recurse
}

Invoke-SpicetifyApplyWithRecovery

Write-Host ""
Write-Rule
Write-Host "Done. " -NoNewline -ForegroundColor Green
Write-Host "Restart Spotify if the app does not pick up changes."
Write-Rule
Write-Host ""
