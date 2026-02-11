<#
Listening Stats – Spicetify Custom App Installer
Author: Xndr2
Source: https://github.com/Xndr2/listening-stats
This script installs the Listening Stats Spicetify app.
#>
# Usage: iwr -useb 'https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.ps1' -OutFile "$env:TEMP\ls-install.ps1"; & "$env:TEMP\ls-install.ps1"; Remove-Item "$env:TEMP\ls-install.ps1"

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Config
$repoUrl = 'https://github.com/Xndr2/listening-stats'
$appName = 'listening-stats'

Write-Host @'
 _     _     _             _               ____  _        _       
| |   (_)___| |_ ___ _ __ (_)_ __   __ _  / ___|| |_ __ _| |_ ___ 
| |   | / __| __/ _ \ '\''_ \| | '\''_ \ / _` | \___ \| __/ _` | __/ __|
| |___| \__ \ ||  __/ | | | | | | | (_| |  ___) | || (_| | |_\__ \
|_____|_|___/\__\___|_| |_|_|_| |_|\__, | |____/ \__\__,_|\__|___/
                                   |___/                          
'@ -ForegroundColor 'Green'

Write-Host 'Listening Stats Installer for Windows' -ForegroundColor 'Cyan'
Write-Host ''

# Check if Spicetify is installed
Write-Host 'Checking for Spicetify...' -NoNewline
try {
    $spicetifyVersion = & spicetify -v 2>$null
    if (-not $spicetifyVersion) {
        throw 'Spicetify not found'
    }
    Write-Host " v$spicetifyVersion" -ForegroundColor 'Green'
} catch {
    Write-Host ' NOT FOUND' -ForegroundColor 'Red'
    Write-Host ''
    Write-Host 'Spicetify is not installed. Please install it first:' -ForegroundColor 'Yellow'
    Write-Host 'iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex' -ForegroundColor 'Cyan'
    Write-Host ''
    exit 1
}

# Get Spicetify paths
Write-Host 'Getting Spicetify config directory...' -NoNewline
try {
    $spicetifyPath = & spicetify path userdata 2>$null
    if (-not $spicetifyPath -or -not (Test-Path $spicetifyPath)) {
        # Fallback to default path
        $spicetifyPath = "$env:APPDATA\spicetify"
    }
    Write-Host " OK" -ForegroundColor 'Green'
} catch {
    $spicetifyPath = "$env:APPDATA\spicetify"
    Write-Host " Using default" -ForegroundColor 'Yellow'
}

$customAppsPath = "$spicetifyPath\CustomApps"
$appPath = "$customAppsPath\$appName"

# Create CustomApps directory if it doesn't exist
if (-not (Test-Path $customAppsPath)) {
    Write-Host 'Creating CustomApps directory...' -NoNewline
    New-Item -ItemType Directory -Path $customAppsPath -Force | Out-Null
    Write-Host ' OK' -ForegroundColor 'Green'
}

# Remove old installation if exists
if (Test-Path $appPath) {
    Write-Host 'Removing old installation...' -NoNewline
    Remove-Item -Path $appPath -Recurse -Force
    Write-Host ' OK' -ForegroundColor 'Green'
}

# Download latest release
Write-Host 'Downloading latest release...' -ForegroundColor 'Cyan'
$tempZip = "$env:TEMP\$appName.zip"
$downloadUrl = "$repoUrl/releases/latest/download/listening-stats.zip"

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip -UseBasicParsing
    Write-Host 'Download complete!' -ForegroundColor 'Green'
} catch {
    Write-Host "Failed to download from releases. Error: $_" -ForegroundColor 'Red'
    Write-Host ''
    Write-Host 'Trying alternative download (dist branch)...' -ForegroundColor 'Yellow'
    
    try {
        $altUrl = "$repoUrl/archive/refs/heads/dist.zip"
        Invoke-WebRequest -Uri $altUrl -OutFile $tempZip -UseBasicParsing
        Write-Host 'Download complete!' -ForegroundColor 'Green'
    } catch {
        Write-Host "Download failed: $_" -ForegroundColor 'Red'
        exit 1
    }
}

# Extract and install
Write-Host 'Installing...' -NoNewline
try {
    # Create temp extraction directory
    $tempExtract = "$env:TEMP\$appName-extract"
    if (Test-Path $tempExtract) {
        Remove-Item -Path $tempExtract -Recurse -Force
    }
    
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force
    
    # Find the actual content directory (might be nested)
    $sourceDir = $tempExtract
    $nested = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
    if ($nested -and (Test-Path "$($nested.FullName)\manifest.json")) {
        $sourceDir = $nested.FullName
    } elseif (Test-Path "$tempExtract\manifest.json") {
        $sourceDir = $tempExtract
    }
    
    # Create app directory and copy files
    New-Item -ItemType Directory -Path $appPath -Force | Out-Null
    Copy-Item -Path "$sourceDir\*" -Destination $appPath -Recurse -Force
    
    # Cleanup
    Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host ' OK' -ForegroundColor 'Green'
} catch {
    Write-Host " FAILED: $_" -ForegroundColor 'Red'
    exit 1
}

# Configure Spicetify
Write-Host 'Configuring Spicetify...' -NoNewline
try {
    & spicetify config custom_apps $appName 2>$null
    Write-Host ' OK' -ForegroundColor 'Green'
} catch {
    Write-Host " Warning: $_" -ForegroundColor 'Yellow'
}

# Apply changes
Write-Host 'Applying changes...' -ForegroundColor 'Cyan'
try {
    & spicetify apply
    Write-Host ''
    Write-Host '✓ Listening Stats installed successfully!' -ForegroundColor 'Green'
    Write-Host ''
    Write-Host 'Restart Spotify if it was running.' -ForegroundColor 'Yellow'
    Write-Host 'You will find Listening Stats in the sidebar.' -ForegroundColor 'Cyan'
} catch {
    Write-Host "Failed to apply: $_" -ForegroundColor 'Red'
    Write-Host ''
    Write-Host 'Try running manually:' -ForegroundColor 'Yellow'
    Write-Host '  spicetify apply' -ForegroundColor 'Cyan'
}

Write-Host ''
