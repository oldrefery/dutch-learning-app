#!/bin/bash

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)

for argument in "$@"; do
  case "$argument" in
    --submit|--build-only)
      echo "Error: build and submission are now separate commands." >&2
      echo "Use scripts/build-release.sh, then scripts/submit-release.sh." >&2
      exit 1
      ;;
  esac
done

echo "Deprecated: build-and-submit.sh only builds locally; it never submits. Use scripts/build-release.sh and scripts/submit-release.sh, or the cloud workflow in docs/EAS_BUILD_GUIDE.md." >&2
exec "$REPO_ROOT/scripts/build-release.sh" "$@"
