#!/bin/bash
# Build Extension Package Script (Linux)
# Packages the Chrome extension into a .zip file for distribution

set -e

# Paths
EXTENSION_PATH="extension"
OUTPUT_PATH="src/Api/wwwroot/downloads"
ZIP_NAME="clinics-whatsapp-extension.zip"
TEMP_DIR="temp-extension-build"

echo "Building Clinics WhatsApp Extension Package..."

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_PATH"
echo "Created output directory: $OUTPUT_PATH"

# Remove old zip if exists
ZIP_PATH="$OUTPUT_PATH/$ZIP_NAME"
if [ -f "$ZIP_PATH" ]; then
    rm -f "$ZIP_PATH"
    echo "Removed old package"
fi

# Create temp directory
if [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
fi
mkdir -p "$TEMP_DIR"

echo "Copying extension files..."

# Copy extension files (exclude node_modules, .git, etc.)
# Copy the folder itself into temp dir so result is temp-extension-build/extension
rsync -av --exclude='node_modules' --exclude='.git' --exclude='.gitignore' \
    --exclude='package-lock.json' --exclude='*.md' --exclude='.DS_Store' \
    --exclude='Thumbs.db' "$EXTENSION_PATH" "$TEMP_DIR/"

echo "Files copied"

# Create zip archive
echo "Creating zip archive..."
cd "$TEMP_DIR"
# Zip the 'extension' folder
zip -r "../$ZIP_PATH" "extension" > /dev/null 2>&1
cd ..

# Clean up temp directory
rm -rf "$TEMP_DIR"

# Get file size
FILE_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
echo "Package created: $ZIP_NAME ($FILE_SIZE)"

echo ""
echo "Extension package built successfully!"
echo "Location: $ZIP_PATH"
