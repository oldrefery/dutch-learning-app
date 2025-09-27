#!/bin/bash
set -e

# --- CONFIGURATIOM ---
SENTRY_ORG="oldrefery"
SENTRY_PROJECT="dutch-learning-app"
IOS_METADATA_FILE="builds/ios-build-metadata.json"
ANDROID_METADATA_FILE="builds/android-build-metadata.json"
TEMP_SOURCEMAP_DIR="builds/temp_sourcemaps" # temp folder for unpacking

upload_to_sentry() {
  local platform=$1
  local metadata_file=$2

  if [ ! -f "$metadata_file" ]; then
    echo "🟡 Metadata file for $platform not found at $metadata_file. Skipping."
    return
  fi

  echo "⚙️ Processing $platform sourcemaps..."

  # 1. get values from app.json and metadata.json
  VERSION=$(node -p "require('./app.json').expo.version")
  BUILD_NUMBER=$(node -p "require($metadata_file)[0].appVersion") # Более надежно брать из метаданных

  if [ "$platform" == "ios" ]; then
    BUNDLE_ID=$(node -p "require('./app.json').expo.ios.bundleIdentifier")
  else
    BUNDLE_ID=$(node -p "require('./app.json').expo.android.package")
  fi

  RELEASE_NAME="${BUNDLE_ID}@${VERSION}+${BUILD_NUMBER}"
  SOURCEMAP_ARCHIVE_PATH=$(node -p "require('$metadata_file')[0].artifacts.sourcemapPath")

  # 2. Unpack the archive to the temp folder
  echo "📦 Unpacking sourcemaps from $SOURCEMAP_ARCHIVE_PATH..."
  rm -rf "$TEMP_SOURCEMAP_DIR" # Clear before using
  mkdir -p "$TEMP_SOURCEMAP_DIR"
  tar -xzf "$SOURCEMAP_ARCHIVE_PATH" -C "$TEMP_SOURCEMAP_DIR"

  # Path to unpacked bundles in the temp folder
  local unpacked_bundles_path="$TEMP_SOURCEMAP_DIR/bundles"

  # 3. Upload to Sentry
  echo "🚀 Uploading $platform sourcemaps for release: $RELEASE_NAME"
  npx sentry-cli releases files "$RELEASE_NAME" upload-sourcemaps \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT" \
    --dist "$BUILD_NUMBER" \
    --strip-prefix "~" \
    "$unpacked_bundles_path"

  echo "✅ $platform sourcemaps uploaded successfully!"

  # 4. Clear the temp folder
  rm -rf "$TEMP_SOURCEMAP_DIR"
}

# --- EXECUTION ---
upload_to_sentry "ios" "$IOS_METADATA_FILE"
echo ""
upload_to_sentry "android" "$ANDROID_METADATA_FILE"
echo ""
echo "🎉 All sourcemaps have been successfully uploaded to Sentry!"
