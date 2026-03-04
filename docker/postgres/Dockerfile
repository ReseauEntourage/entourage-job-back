# Dockerfile pour PostgreSQL avec extensions personnalisées
FROM postgres:14.1-alpine

# Installer les dépendances nécessaires pour compiler pgvector
RUN apk add --no-cache \
    build-base \
    clang \
    llvm-dev \
    git

# Installer pgvector
RUN git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git /tmp/pgvector && \
    cd /tmp/pgvector && \
    make && \
    make install && \
    cd / && \
    rm -rf /tmp/pgvector

# Nettoyer les dépendances de build pour réduire la taille de l'image
RUN apk del build-base clang llvm-dev git

# Le reste de la configuration PostgreSQL standard
# Les extensions seront activées via les migrations
