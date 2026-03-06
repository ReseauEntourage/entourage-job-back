#!/bin/sh
set -e


echo "=========================================="
echo "= Entourage Pro Back-end Test is Running ="
echo "=========================================="
echo "Docker container environment:"
echo "- Node.js version: $(node -v)"
echo "- PNPM version: $(pnpm -v)"
echo "- Operating system: $(uname -a)"
echo "- Current working directory: $(pwd)"
echo "- Environment: $NODE_ENV"
echo "=========================================="

echo "==> Resetting test database..."
pnpm db:drop || true
pnpm db:create
pnpm db:migrate

echo "==> Running tests..."
# Passe tous les arguments à la commande test
pnpm test:e2e -- "$@"