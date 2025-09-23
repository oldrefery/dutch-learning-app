#!/bin/bash

# Build and Submit Script for iOS and Android
# This script builds locally and submits to both App Store Connect and Google Play

set -e  # Exit on any error

echo "🚀 Starting build and submit process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PLATFORM="both"
SUBMIT="true"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --build-only)
            SUBMIT="false"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --platform [ios|android|both]  Build for specific platform (default: both)"
            echo "  --build-only                   Only build, don't submit to stores"
            echo "  --help                         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                             Build and submit for both platforms"
            echo "  $0 --platform ios             Build and submit only for iOS"
            echo "  $0 --platform android         Build and submit only for Android"
            echo "  $0 --build-only               Build both platforms but don't submit"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate platform argument
if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" && "$PLATFORM" != "both" ]]; then
    echo -e "${RED}Error: Platform must be 'ios', 'android', or 'both'${NC}"
    exit 1
fi

# Function to get current version from app.json
get_current_version() {
    node -p "require('./app.json').expo.version"
}

# Function to get current iOS build number
get_ios_build_number() {
    node -p "require('./app.json').expo.ios?.buildNumber || '0'"
}

# Function to get current Android version code
get_android_version_code() {
    node -p "require('./app.json').expo.android?.versionCode || 0"
}

# Function to increment build numbers
increment_build_numbers() {
    local current_ios_build=$1
    local current_android_build=$2
    # Take the maximum of both values and increment
    local max_build=$current_ios_build
    if [ $current_android_build -gt $current_ios_build ]; then
        max_build=$current_android_build
    fi
    local new_build=$((max_build + 1))

    # Update both iOS buildNumber and Android versionCode to the same value
    node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('./app.json', 'utf8'));
        if (!config.expo.ios) config.expo.ios = {};
        if (!config.expo.android) config.expo.android = {};
        config.expo.ios.buildNumber = '$new_build';
        config.expo.android.versionCode = $new_build;
        fs.writeFileSync('./app.json', JSON.stringify(config, null, 2) + '\n');
    "

    echo $new_build
}

# Function to update version
update_version() {
    local new_version=$1
    node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('./app.json', 'utf8'));
        config.expo.version = '$new_version';
        fs.writeFileSync('./app.json', JSON.stringify(config, null, 2) + '\n');
    "
}

# Get current version and build numbers
CURRENT_VERSION=$(get_current_version)
CURRENT_IOS_BUILD=$(get_ios_build_number)
CURRENT_ANDROID_BUILD=$(get_android_version_code)

echo -e "${BLUE}Current version: ${CURRENT_VERSION}${NC}"
echo -e "${BLUE}Current iOS build number: ${CURRENT_IOS_BUILD}${NC}"
echo -e "${BLUE}Current Android version code: ${CURRENT_ANDROID_BUILD}${NC}"

# Ask about version increment
echo ""
echo -e "${YELLOW}Do you want to increment the version? (y/N)${NC}"
read -p "Version increment (current: ${CURRENT_VERSION}): " increment_version

NEW_VERSION=$CURRENT_VERSION
if [[ $increment_version =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Enter new version (current: ${CURRENT_VERSION}):${NC}"
    read -p "New version: " input_version
    if [ ! -z "$input_version" ]; then
        NEW_VERSION=$input_version
        echo -e "${GREEN}Will update version to: ${NEW_VERSION}${NC}"
        update_version $NEW_VERSION
    fi
fi

# Always increment build numbers for both platforms
NEW_BUILD=$(increment_build_numbers $CURRENT_IOS_BUILD $CURRENT_ANDROID_BUILD)
echo -e "${GREEN}Will increment build numbers to: ${NEW_BUILD}${NC}"

# Commit version changes if any
if [ "$NEW_VERSION" != "$CURRENT_VERSION" ] || [ "$NEW_BUILD" != "$CURRENT_IOS_BUILD" ]; then
    echo -e "${BLUE}Committing version changes...${NC}"
    git add app.json

    if [ "$NEW_VERSION" != "$CURRENT_VERSION" ]; then
        git commit -m "chore: bump version to ${NEW_VERSION} and build number to ${NEW_BUILD}"
    else
        git commit -m "chore: bump build number to ${NEW_BUILD}"
    fi
fi

# Create builds directory if it doesn't exist
mkdir -p builds

echo ""
echo -e "${BLUE}Building for platform(s): ${PLATFORM}${NC}"

# Build iOS
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
    echo -e "${GREEN}Building iOS app locally...${NC}"
    echo -e "${YELLOW}Running: eas build --platform ios --profile production --local --output builds/app-${NEW_VERSION}-${NEW_BUILD}.ipa${NC}"
    EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform ios --profile production --local --output "builds/app-${NEW_VERSION}-${NEW_BUILD}.ipa" --non-interactive
    echo -e "${GREEN}✅ iOS build completed!${NC}"
fi

# Build Android
if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
    echo -e "${GREEN}Building Android app locally...${NC}"
    echo -e "${YELLOW}Running: eas build --platform android --profile production --local --output builds/app-${NEW_VERSION}-${NEW_BUILD}.aab${NC}"
    EAS_SKIP_AUTO_FINGERPRINT=1 eas build --platform android --profile production --local --output "builds/app-${NEW_VERSION}-${NEW_BUILD}.aab" --non-interactive
    echo -e "${GREEN}✅ Android build completed!${NC}"
fi

# Submit to stores if requested
if [[ "$SUBMIT" == "true" ]]; then
    echo ""
    echo -e "${BLUE}Submitting to app stores...${NC}"

    # Submit iOS
    if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "both" ]]; then
        echo -e "${GREEN}Submitting iOS to App Store Connect...${NC}"
        IOS_FILE="builds/app-${NEW_VERSION}-${NEW_BUILD}.ipa"
        echo -e "${YELLOW}Running: eas submit -p ios --path ${IOS_FILE}${NC}"
        eas submit -p ios --path "$IOS_FILE"
        echo -e "${GREEN}✅ iOS submission completed!${NC}"
    fi

    # Submit Android
    if [[ "$PLATFORM" == "android" || "$PLATFORM" == "both" ]]; then
        echo -e "${GREEN}Submitting Android to Google Play...${NC}"
        ANDROID_FILE="builds/app-${NEW_VERSION}-${NEW_BUILD}.aab"
        echo -e "${YELLOW}Running: eas submit -p android --path ${ANDROID_FILE}${NC}"
        eas submit -p android --path "$ANDROID_FILE"
        echo -e "${GREEN}✅ Android submission completed!${NC}"
    fi
else
    echo ""
    echo -e "${YELLOW}Skipping store submission (--build-only flag used)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Process completed successfully!${NC}"
echo -e "${BLUE}Version: ${NEW_VERSION}${NC}"
echo -e "${BLUE}Build Number: ${NEW_BUILD}${NC}"
echo -e "${BLUE}Platform(s): ${PLATFORM}${NC}"

if [[ "$SUBMIT" == "true" ]]; then
    echo -e "${BLUE}Status: Built and submitted${NC}"
else
    echo -e "${BLUE}Status: Built only${NC}"
fi

echo ""
echo -e "${YELLOW}Build artifacts saved in ./builds/ directory${NC}"