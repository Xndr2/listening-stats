#!/bin/bash
# Listening Stats - Spicetify CustomApp Installer for Linux/macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/Xndr2/listening-stats/main/install.sh | bash

set -e

# Config
REPO_URL="https://github.com/Xndr2/listening-stats"
APP_NAME="listening-stats"

# Colors
RED='\e[0;31m'
GREEN='\e[0;32m'
YELLOW='\e[1;33m'
CYAN='\e[0;36m'
BOLD='\e[1m'
NC='\e[0m'

print_color() {
    printf "%b%s%b\n" "$1" "$2" "$NC"
}

print_status() {
    printf "%s" "$1"
}

print_ok() {
    printf " %b%s%b\n" "$GREEN" "OK" "$NC"
}

print_fail() {
    printf " %b%s%b\n" "$RED" "FAILED" "$NC"
}

echo ""
printf "%b" "$GREEN"
echo "▗▖   ▗▄▄▄▖ ▗▄▄▖▗▄▄▄▖▗▄▄▄▖▗▖  ▗▖▗▄▄▄▖▗▖  ▗▖ ▗▄▄▖     ▗▄▄▖▗▄▄▄▖▗▄▖▗▄▄▄▖▗▄▄▖"
echo "▐▌     █  ▐▌     █  ▐▌   ▐▛▚▖▐▌  █  ▐▛▚▖▐▌▐▌       ▐▌     █ ▐▌ ▐▌ █ ▐▌   "
echo "▐▌     █   ▝▀▚▖  █  ▐▛▀▀▘▐▌ ▝▜▌  █  ▐▌ ▝▜▌▐▌▝▜▌     ▝▀▚▖  █ ▐▛▀▜▌ █  ▝▀▚▖"
echo "▐▙▄▄▖▗▄█▄▖▗▄▄▞▘  █  ▐▙▄▄▖▐▌  ▐▌▗▄█▄▖▐▌  ▐▌▝▚▄▞▘    ▗▄▄▞▘  █ ▐▌ ▐▌ █ ▗▄▄▞▘"
echo "                                                                         "
printf "%b\n" "$NC"
print_color "$CYAN" "Listening Stats Installer for Linux/macOS"
echo ""

# Check if Spicetify is installed
print_status "Checking for Spicetify..."
if ! command -v spicetify &> /dev/null; then
    print_fail
    echo ""
    print_color "$YELLOW" "Spicetify is not installed. Please install it first:"
    print_color "$CYAN" "curl -fsSL https://raw.githubusercontent.com/spicetify/cli/main/install.sh | sh"
    echo ""
    exit 1
fi

SPICETIFY_VERSION=$(spicetify -v 2>/dev/null || echo "unknown")
printf " %bv%s%b\n" "$GREEN" "$SPICETIFY_VERSION" "$NC"

# Get Spicetify config directory
print_status "Getting Spicetify config directory..."
SPICETIFY_CONFIG=""

# Try to get from spicetify command
if command -v spicetify &> /dev/null; then
    SPICETIFY_CONFIG=$(spicetify path userdata 2>/dev/null || echo "")
fi

# Fallback to common locations
if [ -z "$SPICETIFY_CONFIG" ] || [ ! -d "$SPICETIFY_CONFIG" ]; then
    if [ -d "$HOME/.config/spicetify" ]; then
        SPICETIFY_CONFIG="$HOME/.config/spicetify"
    elif [ -d "$HOME/.spicetify" ]; then
        SPICETIFY_CONFIG="$HOME/.spicetify"
    elif [ -n "$XDG_CONFIG_HOME" ] && [ -d "$XDG_CONFIG_HOME/spicetify" ]; then
        SPICETIFY_CONFIG="$XDG_CONFIG_HOME/spicetify"
    else
        SPICETIFY_CONFIG="$HOME/.config/spicetify"
    fi
fi

print_ok
printf "  → %s\n" "$SPICETIFY_CONFIG"

CUSTOM_APPS_PATH="$SPICETIFY_CONFIG/CustomApps"
APP_PATH="$CUSTOM_APPS_PATH/$APP_NAME"

# Create CustomApps directory if needed
if [ ! -d "$CUSTOM_APPS_PATH" ]; then
    print_status "Creating CustomApps directory..."
    mkdir -p "$CUSTOM_APPS_PATH"
    print_ok
fi

# Remove old installation
if [ -d "$APP_PATH" ]; then
    print_status "Removing old installation..."
    rm -rf "$APP_PATH"
    print_ok
fi

# Download latest release
print_color "$CYAN" "Downloading latest release..."
TEMP_ZIP="/tmp/$APP_NAME.zip"
DOWNLOAD_URL="$REPO_URL/releases/latest/download/listening-stats.zip"

if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl -fsSL"
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget -qO-"
else
    print_color "$RED" "Error: curl or wget is required"
    exit 1
fi

# Try releases first
if ! $DOWNLOAD_CMD "$DOWNLOAD_URL" > "$TEMP_ZIP" 2>/dev/null; then
    print_color "$YELLOW" "Release not found, trying dist branch..."
    ALT_URL="$REPO_URL/archive/refs/heads/dist.zip"
    if ! $DOWNLOAD_CMD "$ALT_URL" > "$TEMP_ZIP" 2>/dev/null; then
        print_color "$RED" "Download failed"
        exit 1
    fi
fi

print_color "$GREEN" "Download complete!"

# Extract and install
print_status "Installing..."
TEMP_EXTRACT="/tmp/$APP_NAME-extract"
rm -rf "$TEMP_EXTRACT"
mkdir -p "$TEMP_EXTRACT"

if command -v unzip &> /dev/null; then
    unzip -q "$TEMP_ZIP" -d "$TEMP_EXTRACT"
else
    print_color "$RED" "Error: unzip is required"
    exit 1
fi

# Find the actual content (might be nested in a directory)
SOURCE_DIR="$TEMP_EXTRACT"
if [ -f "$TEMP_EXTRACT/manifest.json" ]; then
    SOURCE_DIR="$TEMP_EXTRACT"
else
    # Check for nested directory
    NESTED=$(find "$TEMP_EXTRACT" -maxdepth 1 -type d ! -path "$TEMP_EXTRACT" | head -1)
    if [ -n "$NESTED" ] && [ -f "$NESTED/manifest.json" ]; then
        SOURCE_DIR="$NESTED"
    fi
fi

# Create app directory and copy files
mkdir -p "$APP_PATH"
cp -r "$SOURCE_DIR"/* "$APP_PATH/"

# Cleanup
rm -f "$TEMP_ZIP"
rm -rf "$TEMP_EXTRACT"

print_ok

# Configure Spicetify
print_status "Configuring Spicetify..."
spicetify config custom_apps "$APP_NAME" 2>/dev/null || true
print_ok

# Apply changes
print_color "$CYAN" "Applying changes..."
if spicetify apply; then
    echo ""
    print_color "$GREEN" "✓ Listening Stats installed successfully!"
    echo ""
    print_color "$BOLD" "Restart Spotify if it was running."
    print_color "$CYAN" "You will find Listening Stats in the sidebar."
else
    echo ""
    print_color "$YELLOW" "Could not apply automatically. Try running:"
    print_color "$CYAN" "  spicetify apply"
fi

echo ""
