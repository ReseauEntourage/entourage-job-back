#!/bin/bash

# Il faut avoir postgresql@16 installé sur votre machine pour pouvoir exécuter ce script.
# Sur mac: brew install postgresql@16
# puis pg_dump --version

# Définir les variables de connexion à la base de données
DB_HOST="localhost"      # Hôte de la base de données
DB_PORT="5432"           # Port de la base de données
DB_NAME="dbname"         # Nom de la base de données
DB_USER="dbuser"         # Nom d'utilisateur pour se connecter à la base
DB_PASSWORD="dbpassword" # Mot de passe de l'utilisateur

# Obtenir la date du jour au format YYYY-MM-DD
DATE=$(date +%Y-%m-%d)

# Nom du fichier de sortie, incluant la date
OUTPUT_FILE="create_database_structure_$DATE.sql"

# Exporter la variable d'environnement PGPASSWORD pour éviter d'être invité à entrer le mot de passe
export PGPASSWORD=$DB_PASSWORD

# Utilisation de pg_dump pour générer le script de la structure sans les données
# Rediriger la sortie d'erreur vers la sortie standard pour qu'elle soit affichée dans la console
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -s -f $OUTPUT_FILE $DB_NAME

# Vérification si le dump a réussi
if [ $? -eq 0 ]; then
  echo "Le script de création de la structure de la base de données a été généré dans le fichier $OUTPUT_FILE."
else
  echo "Une erreur est survenue lors de la génération du script."
fi

# Supprimer la variable d'environnement PGPASSWORD après utilisation
unset PGPASSWORD
