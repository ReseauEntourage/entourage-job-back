#!/bin/sh

echo "================================"
echo "= Entourage Pro API is Running ="
echo "================================"
echo "Docker container environment:"
echo "- Node.js version: $(node -v)"
echo "- PNPM version: $(pnpm -v)"
echo "- Operating system: $(uname -a)"
echo "- Current working directory: $(pwd)"
echo "- Environment: $NODE_ENV"
echo "- Port: $PORT"
echo "================================"

echo "==> Starting the API..."

# Start the API in the background
pnpm api:dev