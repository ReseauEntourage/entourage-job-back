#!/bin/sh
echo "============================"
echo "= Linkedout API is Running ="
echo "============================"
echo "Docker container environment:"
echo "- Node.js version: $(node -v)"
echo "- NPM version: $(npm -v)"
echo "- Operating system: $(uname -a)"
echo "- Current working directory: $(pwd)"
echo "- Environment: $NODE_ENV"
echo "- Port: $PORT"
echo "============================"

# Afficher la version de Node.js
echo "Node.js version:"
node -v

# Afficher les versions des dépendances système importantes
echo "============================"
echo "= System Dependencies Versions ="
echo "============================"
echo "GraphicsMagick version:"
gm --version || echo "GraphicsMagick not found"
echo "Ghostscript version:"
gs -h || echo "Ghostscript not found"
echo "============================"

npm install -g @nestjs/cli

# Start the API in the background
yarn start:dev &

echo "============================"
echo "= Linkedout Worker is Running ="
echo "============================"

# Start the worker
yarn worker:start:dev