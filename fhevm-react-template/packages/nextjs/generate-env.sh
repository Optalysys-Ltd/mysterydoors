#!/usr/bin/env bash

set -euo pipefail

# Do not clobber a .env file
if [ -e ".env" ]; then
    echo >&2 ".env file already exists"
    exit 1
fi

# The below env vars must be set.
# When this script runs in CI they come from repository/deployment variables.

cat >.env <<EOF
NEXT_PUBLIC_ALCHEMY_API_KEY='${NEXT_PUBLIC_ALCHEMY_API_KEY}'
VERCEL_PROJECT_PRODUCTION_URL='${VERCEL_PROJECT_PRODUCTION_URL}'
VERCEL_URL='${VERCEL_URL}'
VERCEL_ENV='${VERCEL_ENV}'
EOF