#!/bin/bash

set -euo pipefail

for argument in "$@"; do
  case "$argument" in
    --submit|--build-only)
      echo "Error: build and submission are now separate commands." >&2
      echo "Use scripts/build-release.sh, then scripts/submit-release.sh." >&2
      exit 1
      ;;
  esac
done

echo "Note: scripts/build-and-submit.sh is a build-only compatibility wrapper."
exec scripts/build-release.sh "$@"
