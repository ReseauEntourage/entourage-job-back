#!/bin/sh

npm install -g @nestjs/cli

echo "================================="
echo "= Linkedout Worker is Running ="
echo "================================="
echo "Docker container environment:"
echo "- Node.js version: $(node -v)"
echo "- NPM version: $(npm -v)"
echo "- Operating system: $(uname -a)"
echo "- Current working directory: $(pwd)"
echo "- Environment: $NODE_ENV"
echo "- Port: $WORKER_PORT"
echo "================================="

# Start the worker
yarn worker:start:dev