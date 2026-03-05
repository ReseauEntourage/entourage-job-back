#!/bin/sh

echo "================================="
echo "= Linkedout Worker is Running ="
echo "================================="
echo "Docker container environment:"
echo "- Node.js version: $(node -v)"
echo "- PNPM version: $(pnpm -v)"
echo "- Operating system: $(uname -a)"
echo "- Current working directory: $(pwd)"
echo "- Environment: $NODE_ENV"
echo "================================="

echo "==> Starting the worker..."

# Start the worker
pnpm worker:dev