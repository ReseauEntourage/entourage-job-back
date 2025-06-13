# Environnement Heroku dans Docker

Ce dossier contient les fichiers nécessaires pour reproduire l'environnement Heroku dans Docker. L'objectif est de fournir un environnement de développement qui est aussi proche que possible de l'environnement de production sur Heroku.

> **IMPORTANT** : Cette configuration ne gère pas les bases de données dans Docker. L'application se connecte à des bases de données distantes spécifiées dans les variables d'environnement.

## Structure des fichiers

- `docker-compose.yml` : Configuration Docker Compose utilisant le `Dockerfile.heroku-web-only`
- `docker-heroku-entrypoint-web-only.sh` : Script d'entrée qui exécute uniquement le serveur web (sans worker)
- `heroku.env` : Variables d'environnement pour configurer la connexion aux bases de données distantes
- `start.sh` : Script de démarrage de l'environnement Heroku
- `apply-buildpacks.sh` : Script qui simule l'application des buildpacks Heroku durant la construction du conteneur
- `manage-buildpacks.sh` : Utilitaire pour gérer les buildpacks utilisés dans votre environnement
- `.buildpacks` : Liste des buildpacks configurés pour l'application

## Connexion aux bases de données

Cette configuration est conçue pour se connecter à des bases de données **distantes**. Vous devez configurer les variables d'environnement dans le fichier `heroku.env` pour qu'elles pointent vers vos instances PostgreSQL et Redis distantes :

```sh
# Exemple de configuration PostgreSQL
DB_HOST=votre-hote-postgresql-distant
DB_PORT=5432
DB_USER=votre-utilisateur
DB_PASSWORD=votre-mot-de-passe
DB_NAME=votre-base-de-donnees

# Exemple de configuration Redis
REDIS_HOST=votre-hote-redis-distant
REDIS_PORT=6379
REDIS_PASSWORD=votre-mot-de-passe-redis
```

## Utilisation

La façon la plus simple de démarrer l'environnement est d'utiliser le script `start.sh` :

```sh
./start.sh
```

Ce script lancera directement l'environnement Heroku sans vérifier les bases de données, car l'application se connectera à des bases de données distantes.

L'application sera disponible à l'adresse http://localhost:3002

## Configuration

Vous **devez** modifier les variables d'environnement dans le fichier `heroku.env` pour spécifier les connexions à vos bases de données distantes avant de démarrer l'application.

## Comment cela fonctionne

Cette configuration :

1. Utilise l'image `heroku/heroku:24` comme base (via le Dockerfile.heroku-web-only)
2. Configure les variables d'environnement via le fichier heroku.env
3. **Se connecte uniquement à des bases de données distantes** spécifiées dans les variables d'environnement
4. N'initialise ni ne gère aucune base de données dans Docker
5. Exécute uniquement le serveur web (sans worker) comme demandé

## Gestion des buildpacks

Les buildpacks Heroku sont des scripts qui préparent votre code pour l'exécution. Dans notre configuration Docker, nous simulons ce comportement en installant les dépendances nécessaires et en exécutant des scripts similaires.

### Liste des buildpacks pré-installés

- NodeJS buildpack (via l'installation de Node.js)
- Aptfile buildpack (via l'installation des dépendances système)

### Ajouter ou gérer des buildpacks

Utilisez le script `manage-buildpacks.sh` pour gérer les buildpacks :

```bash
# Afficher les buildpacks configurés
./manage-buildpacks.sh list

# Ajouter un buildpack
./manage-buildpacks.sh add heroku/nodejs

# Supprimer un buildpack
./manage-buildpacks.sh remove heroku/nodejs
```

Après avoir ajouté ou supprimé un buildpack, vous devrez reconstruire l'image Docker :

```bash
./start.sh
```

## Ajouter le worker plus tard

Si vous souhaitez ajouter le worker plus tard :

1. Modifiez le fichier `heroku.env` :

   ```
   DISABLE_WORKER=false
   ```

2. Modifiez le docker-compose.yml pour utiliser le script d'entrée original :

   ```yaml
   volumes:
     - ../docker-heroku-entrypoint.sh:/app/docker-heroku-entrypoint.sh
   ```

3. Modifiez le Dockerfile.heroku-web-only pour utiliser le script d'entrée original

## Différences avec Heroku

- Certaines configurations spécifiques à Heroku peuvent ne pas être présentes
- Les add-ons Heroku ne sont pas automatiquement configurés, vous devez les configurer manuellement via les variables d'environnement
- Certaines fonctionnalités de scaling et de déploiement ne sont pas disponibles
