#!/bin/bash

# Ce script permet de démarrer l'environnement Heroku dans Docker

# Aller dans le répertoire heroku-env
cd "$(dirname "$0")"

echo "Démarrage de l'environnement Heroku..."

# Détection du système d'exploitation
OS=$(uname -s)

# On ne vérifie plus les bases de données, car l'application se connecte à des bases distantes
echo "L'application utilisera les variables d'environnement pour se connecter aux bases de données distantes."
echo "Assurez-vous que les variables d'environnement dans le fichier .env.heroku sont correctement configurées."

# Si on est sur macOS, on utilise le script spécifique qui gère l'adresse IP correctement
if [ "$OS" = "Darwin" ]; then
    echo "Système macOS détecté. Utilisation du script spécifique pour macOS..."
    ./start-mac.sh
    exit 0
fi

# Pour les autres systèmes (Linux), continuer avec la méthode standard
# Arrêter les conteneurs existants de l'environnement Heroku
echo "Arrêt des conteneurs existants de l'environnement Heroku..."
docker-compose down

# Démarrer l'environnement Heroku
echo "Démarrage de l'environnement Heroku..."
docker-compose up --build
