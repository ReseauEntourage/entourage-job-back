# ==== CONFIGURE BACK =====
# USE NODE 20
FROM node:20.19.1-alpine3.21 AS base
# GO INSIDE WORKING DIR
WORKDIR /home/node
# THEN COPY MAIN FILE FOR FIRST
COPY package.json .
COPY yarn.lock .
COPY docker-entrypoint.sh .
# TO GRANT ENTRYPOINT.SH EXECUTION
RUN chmod +x docker-entrypoint.sh
# INSTALL PACKAGE TO PREVENT SHARP NODE MODULE ISSUE
RUN apk add musl
# THEN INSTALL NODE MODULES
RUN yarn install
# EXPOSE 3002 FOR API AND 3003 FOR WORKER
EXPOSE 3002
EXPOSE 3003

# ENTRYPOINT ["tail", "-f", "/dev/null"]
ENTRYPOINT ["/bin/sh", "docker-entrypoint.sh"]