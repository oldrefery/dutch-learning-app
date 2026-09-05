#!/bin/bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_ROOT"
source "$REPO_ROOT/scripts/verify-eas-identity.sh"

# Keep the publication destination and the uploaded source maps inseparable.
# Accept only options that do not override bundling or the production target.
UPDATE_ARGS=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --message|-m|--platform|-p)
      [ "$#" -ge 2 ] || { echo "Error: $1 requires a value" >&2; exit 1; }
      case "$2" in
        ''|-*) echo "Error: $1 requires a non-option value" >&2; exit 1 ;;
      esac
      if [ "$1" = "--platform" ] || [ "$1" = "-p" ]; then
        case "$2" in
          ios|android|all) ;;
          *) echo 'Error: platform must be ios, android, or all' >&2; exit 1 ;;
        esac
      fi
      UPDATE_ARGS+=("$1" "$2")
      shift 2
      ;;
    --non-interactive)
      UPDATE_ARGS+=("$1")
      shift
      ;;
    --help|-h)
      echo 'Usage: npm run update:production -- [--message TEXT] [--platform ios|android|all] [--non-interactive]'
      echo 'Verifies the personal Expo account, publishes to production, then uploads apps/mobile/dist source maps.'
      exit 0
      ;;
    *)
      echo "Error: unsupported production update option: $1" >&2
      exit 1
      ;;
  esac
done

verify_eas_identity

echo "🚀 Publishing production EAS update..."
(cd apps/mobile && npx -y eas-cli@latest update --channel production --environment production ${UPDATE_ARGS[@]+"${UPDATE_ARGS[@]}"})

echo ""
echo "⬆️ Uploading EAS Update source maps to Sentry..."
if ! bash scripts/upload-sourcemaps.sh --update-dist apps/mobile/dist; then
  echo 'Error: the update was published, but source map upload failed. Do not republish; retry npm run sourcemaps:update with the same apps/mobile/dist.' >&2
  exit 1
fi
