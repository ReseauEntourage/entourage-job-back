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

npm install -g @nestjs/cli

# Start the API in the background
yarn start:dev &

echo "============================"
echo "= Linkedout Worker is Running ="
echo "============================"

# Start the worker
yarn worker:start:dev