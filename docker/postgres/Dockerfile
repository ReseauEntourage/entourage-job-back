# Dockerfile pour PostgreSQL avec extensions personnalisées
FROM postgres:17.6-alpine

# Installer pgvector directement depuis les dépôts Alpine
RUN apk add --no-cache postgresql-pgvector

# Le reste de la configuration PostgreSQL standard
# Les extensions seront activées via les migrations
