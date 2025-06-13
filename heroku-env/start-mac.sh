#!/bin/bash

# Script pour démarrer l'environnement Docker sur macOS
# Ce script détecte l'adresse IP de l'hôte et remplace les variables d'environnement

# Obtenir l'adresse IP de l'interface en0 (Wi-Fi) ou en1 (Ethernet)
HOST_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

if [ -z "$HOST_IP" ]; then
  echo "❌ Impossible de détecter l'adresse IP de l'hôte. Vérifiez votre connexion réseau."
  echo "⚠️ Utilisation de la méthode alternative avec host.docker.internal."
  echo "   Si la connexion à la base de données échoue, vérifiez que PostgreSQL et Redis acceptent"
  echo "   les connexions depuis n'importe quelle adresse IP locale."

  # Créer un fichier d'environnement Docker Compose custom
  echo "DATABASE_URL=postgres://linkedout:linkedout@host.docker.internal:5432/linkedout" > docker-compose.mac.env
  echo "DB_HOST=host.docker.internal" >> docker-compose.mac.env
  echo "REDIS_URL=redis://host.docker.internal:6379" >> docker-compose.mac.env
  echo "REDIS_HOST=host.docker.internal" >> docker-compose.mac.env
  
  # Arrêter les conteneurs existants
  echo "🔄 Arrêt des conteneurs existants..."
  docker-compose down
  
  # Démarrer avec notre fichier de configuration spécifique
  echo "🚀 Démarrage du conteneur avec host.docker.internal..."
  docker-compose --env-file docker-compose.mac.env up --build
  exit 0
fi

echo "✅ Adresse IP de l'hôte détectée: $HOST_IP"

# Créer un fichier temporaire avec les bonnes variables d'environnement
TMP_ENV_FILE="docker-compose.mac.env"
cp heroku.env $TMP_ENV_FILE

# Ajouter les variables spécifiques avec l'adresse IP réelle de l'hôte
echo "DATABASE_URL=postgres://linkedout:linkedout@$HOST_IP:5432/linkedout" > $TMP_ENV_FILE
echo "DB_HOST=$HOST_IP" >> $TMP_ENV_FILE
echo "REDIS_URL=redis://$HOST_IP:6379" >> $TMP_ENV_FILE
echo "REDIS_HOST=$HOST_IP" >> $TMP_ENV_FILE
echo "PORT=3002" >> $TMP_ENV_FILE
echo "NODE_ENV=production" >> $TMP_ENV_FILE

echo "✅ Variables d'environnement configurées avec l'adresse IP de l'hôte"

# Arrêter les conteneurs existants s'ils sont en cours d'exécution
echo "🔄 Arrêt des conteneurs existants..."
docker-compose down

# Démarrer avec le fichier d'environnement personnalisé
echo "🚀 Démarrage du conteneur avec l'adresse IP de l'hôte: $HOST_IP"
docker-compose --env-file $TMP_ENV_FILE up --build

# Note: Pas besoin de supprimer le fichier temporaire car il est réutilisable
