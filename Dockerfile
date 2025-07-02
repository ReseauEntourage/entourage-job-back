# ==== CONFIGURE BACK =====
FROM node:20.19.1-slim AS base

# GO INSIDE WORKING DIR
WORKDIR /home/node

# COPY FILES FIRST
COPY package.json .
COPY yarn.lock .
COPY docker-entrypoint.sh .

# GRANT ENTRYPOINT EXEC
RUN chmod +x docker-entrypoint.sh

# INSTALL SYSTEM DEPS
RUN apt-get update && apt-get install -y \
  bash \
  procps \
  build-essential \
  libvips-dev \
  libjpeg-dev \
  libpng-dev \
  zlib1g-dev \
  python3 \
  && rm -rf /var/lib/apt/lists/*

# THEN INSTALL NODE MODULES
RUN yarn install

# EXPOSE PORTS
EXPOSE 3002
EXPOSE 3003

ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]