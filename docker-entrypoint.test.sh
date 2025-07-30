#!/bin/sh
set -e

echo "==> Resetting test database..."
yarn db:drop || true
yarn db:create
yarn db:migrate

echo "==> Running tests..."
# Passe tous les arguments à la commande test
yarn test:e2e -- "$@"