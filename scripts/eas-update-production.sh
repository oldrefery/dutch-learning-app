#!/bin/bash
set -e

echo "🚀 Publishing production EAS update..."
(cd apps/mobile && npx -y eas-cli@latest update --channel production --environment production "$@")

echo ""
echo "⬆️ Uploading EAS Update source maps to Sentry..."
scripts/upload-sourcemaps.sh --update-dist apps/mobile/dist
