#!/usr/bin/env bash

# Do not clobber a .env file
# if [ -e ".env" ]; then
#     echo >&2 ".env file already exists"
#     exit 1
# fi

# The below env vars must be set.
# When this script runs in CI they come from repository/deployment variables.

cat >.env <<EOF
NEXT_PUBLIC_ALCHEMY_API_KEY="${NEXT_PUBLIC_ALCHEMY_API_KEY}"
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=""
NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL="${VERCEL_PROJECT_PRODUCTION_URL}"
NEXT_PUBLIC_VERCEL_URL="${VERCEL_URL}"
NEXT_PUBLIC_VERCEL_ENV="${VERCEL_ENV}"
EOF