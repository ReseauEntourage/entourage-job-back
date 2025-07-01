#!/bin/bash

# Script pour vérifier et configurer PostgreSQL et Redis pour accepter les connexions depuis Docker

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Vérification de la configuration des bases de données pour Docker...${NC}"

# Vérifier si PostgreSQL est installé
if ! command -v pg_isready &> /dev/null; then
    echo -e "${RED}PostgreSQL n'est pas installé ou pas dans le PATH.${NC}"
    echo -e "${YELLOW}Installez PostgreSQL avec Homebrew : brew install postgresql${NC}"
    HAS_PG=false
else
    HAS_PG=true
    echo -e "${GREEN}PostgreSQL est installé.${NC}"
    
    # Vérifier si PostgreSQL est en cours d'exécution
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo -e "${GREEN}PostgreSQL est en cours d'exécution sur le port 5432.${NC}"
    else
        echo -e "${RED}PostgreSQL ne semble pas être en cours d'exécution.${NC}"
        echo -e "${YELLOW}Démarrez PostgreSQL avec : brew services start postgresql${NC}"
    fi
fi

# Vérifier si Redis est installé
if ! command -v redis-cli &> /dev/null; then
    echo -e "${RED}Redis n'est pas installé ou pas dans le PATH.${NC}"
    echo -e "${YELLOW}Installez Redis avec Homebrew : brew install redis${NC}"
    HAS_REDIS=false
else
    HAS_REDIS=true
    echo -e "${GREEN}Redis est installé.${NC}"
    
    # Vérifier si Redis est en cours d'exécution
    if redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}Redis est en cours d'exécution et répond aux pings.${NC}"
    else
        echo -e "${RED}Redis ne semble pas être en cours d'exécution.${NC}"
        echo -e "${YELLOW}Démarrez Redis avec : brew services start redis${NC}"
    fi
fi

# Vérifier si la base de données linkedout existe
if $HAS_PG; then
    if psql -lqt | cut -d \| -f 1 | grep -qw linkedout; then
        echo -e "${GREEN}La base de données 'linkedout' existe.${NC}"
    else
        echo -e "${YELLOW}La base de données 'linkedout' n'existe pas.${NC}"
        echo -e "Voulez-vous la créer ? (o/n) "
        read -r response
        if [[ "$response" =~ ^([oO][uU][iI]|[oO])$ ]]; then
            echo -e "${YELLOW}Création de la base de données 'linkedout'...${NC}"
            createdb linkedout
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Base de données 'linkedout' créée avec succès.${NC}"
                
                # Création de l'utilisateur linkedout
                psql -d linkedout -c "CREATE USER linkedout WITH PASSWORD 'linkedout';"
                psql -d linkedout -c "GRANT ALL PRIVILEGES ON DATABASE linkedout TO linkedout;"
                psql -d linkedout -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO linkedout;"
                psql -d linkedout -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO linkedout;"
                
                echo -e "${GREEN}Utilisateur 'linkedout' créé avec le mot de passe 'linkedout'.${NC}"
            else
                echo -e "${RED}Échec de la création de la base de données 'linkedout'.${NC}"
            fi
        fi
    fi
fi

# Vérifier la configuration de PostgreSQL pour les connexions
if $HAS_PG; then
    PG_CONF=$(psql -t -c "SHOW config_file;")
    PG_HBA=$(psql -t -c "SHOW hba_file;")
    
    echo -e "${YELLOW}Fichier de configuration PostgreSQL : $PG_CONF${NC}"
    echo -e "${YELLOW}Fichier de configuration des accès (pg_hba.conf) : $PG_HBA${NC}"
    
    echo -e "${YELLOW}Vérifiez que PostgreSQL est configuré pour accepter les connexions depuis l'adresse IP de l'hôte.${NC}"
    echo -e "${YELLOW}Dans le fichier pg_hba.conf, assurez-vous d'avoir une ligne comme:${NC}"
    echo -e "${YELLOW}host    all             all             0.0.0.0/0               md5${NC}"
    echo -e "${YELLOW}Et dans postgresql.conf, vérifiez que listen_addresses = '*'${NC}"
    
    echo -e "Voulez-vous que je modifie automatiquement ces fichiers ? (o/n) - ATTENTION: Ceci peut nécessiter des droits d'administrateur"
    read -r response
    if [[ "$response" =~ ^([oO][uU][iI]|[oO])$ ]]; then
        # Modifier postgresql.conf
        sudo sed -i.bak "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$PG_CONF"
        
        # Ajouter une ligne à pg_hba.conf si elle n'existe pas déjà
        if ! grep -q "host    all             all             0.0.0.0/0               md5" "$PG_HBA"; then
            echo "host    all             all             0.0.0.0/0               md5" | sudo tee -a "$PG_HBA" > /dev/null
        fi
        
        echo -e "${GREEN}Configuration modifiée. Redémarrage de PostgreSQL nécessaire.${NC}"
        brew services restart postgresql
    fi
fi

# Vérifier la configuration de Redis pour les connexions
if $HAS_REDIS; then
    REDIS_CONF=$(brew --prefix)/etc/redis.conf
    
    echo -e "${YELLOW}Fichier de configuration Redis : $REDIS_CONF${NC}"
    echo -e "${YELLOW}Vérifiez que Redis est configuré pour accepter les connexions sur toutes les interfaces:${NC}"
    echo -e "${YELLOW}Dans le fichier redis.conf, assurez-vous d'avoir: bind 0.0.0.0${NC}"
    
    echo -e "Voulez-vous que je modifie automatiquement ce fichier ? (o/n)"
    read -r response
    if [[ "$response" =~ ^([oO][uU][iI]|[oO])$ ]]; then
        # Modifier redis.conf
        if grep -q "bind 127.0.0.1" "$REDIS_CONF"; then
            sudo sed -i.bak "s/bind 127.0.0.1/bind 0.0.0.0/g" "$REDIS_CONF"
        fi
        
        echo -e "${GREEN}Configuration modifiée. Redémarrage de Redis nécessaire.${NC}"
        brew services restart redis
    fi
fi

echo -e "${GREEN}Vérification terminée. Assurez-vous que PostgreSQL et Redis sont correctement configurés et accessibles.${NC}"

# Obtenir l'adresse IP de l'interface en0 (Wi-Fi) ou en1 (Ethernet)
HOST_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
if [ -n "$HOST_IP" ]; then
    echo -e "${GREEN}Adresse IP de l'hôte : $HOST_IP${NC}"
    echo -e "${YELLOW}Pour la configuration Docker, utilisez cette adresse IP au lieu de 'localhost'.${NC}"
fi

echo -e "${YELLOW}Une fois que tout est configuré, lancez l'environnement Docker avec:${NC}"
echo -e "${GREEN}cd /Users/dorian/dev/entourage-job-back/heroku-env && ./start.sh${NC}"
