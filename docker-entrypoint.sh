#!/bin/sh
echo "============================"
echo "= Linkedout API is Running ="
echo "============================"

npm install -g @nestjs/cli

# Start the API in the background
yarn start:dev &

echo "============================"
echo "= Linkedout Worker is Running ="
echo "============================"

# Start the worker
yarn worker:start:dev