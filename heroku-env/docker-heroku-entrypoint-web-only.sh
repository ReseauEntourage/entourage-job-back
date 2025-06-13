#!/bin/bash

echo "======================================"
echo "= Starting Heroku-like Docker Environment ="
echo "======================================"
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "User: $(whoami)"
echo "======================================"
echo "L'application utilisera les variables d'environnement pour se connecter aux bases de données distantes"
echo "======================================"

# Chargement des variables d'environnement depuis le fichier .env.heroku
if [ -f /app/heroku-env/.env.heroku ]; then
  echo "Chargement des variables d'environnement depuis .env.heroku"
  export $(cat /app/heroku-env/.env.heroku | grep -v '^#' | xargs)
fi

# Vérification des permissions
if [ ! -w /app/dist ]; then
  echo "Attention : L'utilisateur heroku n'a pas les permissions d'écriture sur /app/dist"
  echo "Cela peut causer des problèmes lors de l'exécution de l'application"
fi

# Pas de migrations de base de données, les bases sont gérées en dehors du conteneur

# Avec l'approche multi-stage, les fichiers sont déjà au bon endroit
echo "Vérification de la structure du build..."
echo "Contenu du répertoire /app/dist :"
ls -la /app/dist

# Afficher les informations de connexion à la base de données (sans montrer les mots de passe)
echo "Configuration des connexions aux bases de données :"
echo "DATABASE_URL: $(echo $DATABASE_URL | sed 's/:\/\/[^:]*:[^@]*@/:\/\/username:password@/')"
echo "DB_HOST: $DB_HOST"
echo "DB_PORT: $DB_PORT"
echo "REDIS_URL: $(echo $REDIS_URL | sed 's/:\/\/[^:]*:[^@]*@/:\/\/username:password@/')"
echo "REDIS_HOST: $REDIS_HOST"
echo "REDIS_PORT: $REDIS_PORT"

# Dans le Dockerfile multi-stage, nous avons déjà vérifié la présence des fichiers
# Nous n'avons pas besoin de reconstruire l'application ici

# Tester la connectivité à la base de données PostgreSQL
echo "Test de connectivité à PostgreSQL à $DB_HOST:$DB_PORT..."
if command -v nc &> /dev/null; then
  if nc -z -w 2 $DB_HOST $DB_PORT; then
    echo "✅ Connexion à PostgreSQL établie avec succès !"
  else
    echo "❌ ERREUR: Impossible de se connecter à PostgreSQL à $DB_HOST:$DB_PORT"
    echo "Vérifiez que PostgreSQL est en cours d'exécution et accessible depuis le conteneur Docker."
  fi
else
  echo "⚠️  La commande 'nc' n'est pas disponible, impossible de tester la connectivité à PostgreSQL."
fi

# Tester la connectivité à Redis
echo "Test de connectivité à Redis à $REDIS_HOST:$REDIS_PORT..."
if command -v nc &> /dev/null; then
  if nc -z -w 2 $REDIS_HOST $REDIS_PORT; then
    echo "✅ Connexion à Redis établie avec succès !"
  else
    echo "❌ ERREUR: Impossible de se connecter à Redis à $REDIS_HOST:$REDIS_PORT"
    echo "Vérifiez que Redis est en cours d'exécution et accessible depuis le conteneur Docker."
  fi
else
  echo "⚠️  La commande 'nc' n'est pas disponible, impossible de tester la connectivité à Redis."
fi

# Start the web process only (as requested)
echo "Starting web process..."
# Notre Dockerfile multi-stage a déjà vérifié l'existence du fichier dans /app/dist/src/main.js
if [ -f "/app/dist/src/main.js" ]; then
  echo "Démarrage de l'application avec node dist/src/main"
  NODE_PATH=/app exec node dist/src/main
else
  echo "ERREUR: Impossible de trouver le fichier main.js"
  echo "Contenu de /app/dist :"
  find /app/dist -type f | grep -i main
  exit 1
fi
