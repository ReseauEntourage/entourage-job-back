# PostgreSQL avec Extensions Personnalisées

Ce dossier contient le Dockerfile pour construire une image PostgreSQL personnalisée avec les extensions nécessaires.

## Extensions installées

- **pgvector** (v0.5.1) : Extension pour les vecteurs et recherche de similarité

## Ajouter une nouvelle extension

Pour ajouter une nouvelle extension PostgreSQL :

1. **Éditer le Dockerfile** : Ajouter les commandes d'installation de l'extension

   Exemple pour installer une extension depuis les packages Alpine :

   ```dockerfile
   RUN apk add --no-cache postgresql-contrib
   ```

   Exemple pour compiler une extension depuis les sources :

   ```dockerfile
   RUN git clone https://github.com/example/pg-extension.git /tmp/pg-extension && \
       cd /tmp/pg-extension && \
       make && \
       make install && \
       rm -rf /tmp/pg-extension
   ```

2. **Créer une migration** : Activer l'extension dans la base de données

   ```javascript
   await queryInterface.sequelize.query(
     'CREATE EXTENSION IF NOT EXISTS nom_extension;'
   );
   ```

3. **Reconstruire l'image** :
   ```bash
   docker-compose build linkedout-db
   docker-compose up -d linkedout-db
   ```
