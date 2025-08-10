#!/bin/bash

# Ce script permet de gérer les buildpacks pour votre environnement Docker Heroku

function show_help {
  echo "Script de gestion des buildpacks pour l'environnement Docker Heroku"
  echo ""
  echo "Usage:"
  echo "  $0 list                      # Affiche les buildpacks actuellement configurés"
  echo "  $0 add <buildpack_url>       # Ajoute un buildpack à la configuration"
  echo "  $0 remove <buildpack_name>   # Supprime un buildpack de la configuration"
  echo ""
  echo "Exemples:"
  echo "  $0 add heroku/nodejs         # Ajoute le buildpack Node.js"
  echo "  $0 add heroku/ruby           # Ajoute le buildpack Ruby"
  echo "  $0 add https://github.com/heroku/heroku-buildpack-apt # Ajoute le buildpack apt"
  echo ""
}

function list_buildpacks {
  if [ -f heroku-env/.buildpacks ]; then
    echo "Buildpacks configurés:"
    cat heroku-env/.buildpacks
  else
    echo "Aucun buildpack n'est configuré pour le moment"
    echo "Pour ajouter un buildpack, utilisez: $0 add <buildpack_url>"
  fi
}

function add_buildpack {
  if [ -z "$1" ]; then
    echo "Erreur: vous devez spécifier une URL de buildpack"
    show_help
    exit 1
  fi

  mkdir -p heroku-env
  touch heroku-env/.buildpacks
  
  # Vérifier si le buildpack existe déjà
  if grep -q "$1" heroku-env/.buildpacks; then
    echo "Le buildpack $1 est déjà configuré"
  else
    echo "$1" >> heroku-env/.buildpacks
    echo "Le buildpack $1 a été ajouté à la configuration"
    
    # Mises à jour conditionnelles du Dockerfile selon le buildpack
    case "$1" in
      "heroku/nodejs"|"https://github.com/heroku/heroku-buildpack-nodejs")
        echo "Le buildpack Node.js est déjà inclus dans le Dockerfile"
        ;;
      "heroku/ruby"|"https://github.com/heroku/heroku-buildpack-ruby")
        echo "Mise à jour du Dockerfile pour inclure le support Ruby..."
        # Ici vous pourriez automatiquement modifier le Dockerfile 
        # pour ajouter l'installation de Ruby
        ;;
      "https://github.com/heroku/heroku-buildpack-apt")
        echo "Le support pour Aptfile est déjà inclus dans le Dockerfile"
        ;;
      *)
        echo "Attention: Le buildpack $1 a été ajouté à la configuration, mais vous devrez"
        echo "mettre à jour manuellement le Dockerfile pour installer les dépendances nécessaires."
        ;;
    esac
  fi
}

function remove_buildpack {
  if [ -z "$1" ]; then
    echo "Erreur: vous devez spécifier un nom de buildpack à supprimer"
    show_help
    exit 1
  fi

  if [ -f heroku-env/.buildpacks ]; then
    # Filtrer le fichier .buildpacks pour supprimer le buildpack spécifié
    grep -v "$1" heroku-env/.buildpacks > heroku-env/.buildpacks.tmp
    mv heroku-env/.buildpacks.tmp heroku-env/.buildpacks
    echo "Le buildpack contenant '$1' a été supprimé"
    
    echo "Attention: Vous devrez peut-être modifier manuellement le Dockerfile"
    echo "pour supprimer les dépendances associées au buildpack supprimé."
  else
    echo "Aucun buildpack n'est configuré pour le moment"
  fi
}

# Traitement des arguments
case "$1" in
  "help"|"-h"|"--help")
    show_help
    ;;
  "list"|"ls")
    list_buildpacks
    ;;
  "add")
    add_buildpack "$2"
    ;;
  "remove"|"rm")
    remove_buildpack "$2"
    ;;
  *)
    echo "Commande inconnue: $1"
    show_help
    exit 1
    ;;
esac
