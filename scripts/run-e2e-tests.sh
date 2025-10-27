#!/bin/bash

# Load environment variables from .env file
set -a
source .env
set +a

# Set Maestro environment variables from EXPO_PUBLIC_* variables
export MAESTRO_TEST_EMAIL="${EXPO_PUBLIC_DEV_USER_EMAIL}"
export MAESTRO_TEST_PASSWORD="${EXPO_PUBLIC_DEV_USER_PASSWORD}"

echo "🧪 Running E2E tests with credentials from .env"
echo "📧 Email: ${MAESTRO_TEST_EMAIL:0:5}***"

# Run Maestro tests
if [ "$1" = "all" ]; then
  maestro test .maestro/
else
  maestro test .maestro/01-auth-login.yaml
fi
