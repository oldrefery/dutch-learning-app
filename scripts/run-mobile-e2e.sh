#!/bin/bash

set -euo pipefail

FLOW_PATH="${1:-apps/mobile/.maestro/01-auth-login.yaml}"
PLATFORM="${2:-ios}"

case "$PLATFORM" in
  ios) APP_ID="com.oldrefery.dutch-learning-app" ;;
  android) APP_ID="com.oldrefery.dutchlearningapp" ;;
  *)
    echo "Error: platform must be ios or android" >&2
    exit 1
    ;;
esac

set -a
[ -f apps/mobile/.maestro/.maestro.env ] && source apps/mobile/.maestro/.maestro.env
[ -f apps/mobile/.env ] && source apps/mobile/.env
set +a

: "${MAESTRO_TEST_EMAIL:=${EXPO_PUBLIC_DEV_USER_EMAIL:-}}"
: "${MAESTRO_TEST_PASSWORD:=${EXPO_PUBLIC_DEV_USER_PASSWORD:-}}"

if [ -z "$MAESTRO_TEST_EMAIL" ] || [ -z "$MAESTRO_TEST_PASSWORD" ]; then
  echo "Error: Maestro test credentials are not configured" >&2
  exit 1
fi

export MAESTRO_TEST_EMAIL MAESTRO_TEST_PASSWORD

maestro test "$FLOW_PATH" \
  -e "APP_ID=$APP_ID" \
  --env "MAESTRO_TEST_EMAIL=$MAESTRO_TEST_EMAIL" \
  --env "MAESTRO_TEST_PASSWORD=$MAESTRO_TEST_PASSWORD"
