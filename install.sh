#!/bin/bash

# TimeVault Installation Script
# This script clones the latest source code from GitHub and sets up the timevault CLI tool.

set -e

echo "Starting TimeVault installation..."

# Requirements check
if ! command -v git >/dev/null 2>&1; then
    echo "Error: 'git' is not installed. Please install git and try again."
    exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "Warning: 'python3' is not installed. You will need it to run the local server."
fi

INSTALL_DIR="$HOME/.timevault"

# Clone or Update the repository
if [ -d "$INSTALL_DIR" ]; then
    echo "Directory $INSTALL_DIR already exists."
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "Cloning TimeVault repository to $INSTALL_DIR..."
    git clone https://github.com/Abdelrhmansersawy/TimeVault "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Ensure the timevault script is executable
chmod +x timevault

# Run the project's internal install command
echo "Setting up CLI command in ~/.local/bin..."
./timevault install

echo ""
echo "=================================================="
echo " TimeVault Installation Complete!                 "
echo "=================================================="
echo ""
echo "To get started, simply type:"
echo "  timevault open"
echo ""
echo "Note: Ensure ~/.local/bin is in your system's PATH."
