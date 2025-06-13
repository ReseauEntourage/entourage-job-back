#!/bin/bash
set -e

# Chargement des variables d'environnement depuis le fichier heroku.env
if [ -f /app/heroku-env/heroku.env ]; then
  echo "Chargement des variables d'environnement depuis heroku.env"
  export $(cat /app/heroku-env/heroku.env | grep -v '^#' | xargs)
fi

# Exécution des migrations de base de données (comme dans la commande release du Procfile)
echo "Exécution des migrations de base de données..."
yarn db:migrate

# Démarrage du serveur web (comme dans le Procfile)
echo "Démarrage de l'application web..."
yarn start
