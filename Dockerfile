# ==== CONFIGURE BACK =====
FROM node:20.19.1-slim AS base

# GO INSIDE WORKING DIR
WORKDIR /home/node

# COPY FILES FIRST
COPY package.json .
COPY pnpm-lock.yaml .
COPY pnpm-workspace.yaml .
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
  poppler-utils \
  python3 \
  && rm -rf /var/lib/apt/lists/*

# INSTALL PNPM
RUN npm install -g pnpm@10.30.3

# NOTE: node_modules installation is done in entrypoint scripts
# because the volume mount overwrites the image's node_modules

# EXPOSE PORTS
EXPOSE 3002

RUN pnpm install

# Required to be able to override entrypoint in worker and test compose files
ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]