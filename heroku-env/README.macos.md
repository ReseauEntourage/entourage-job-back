# Configuration de l'environnement Heroku dans Docker pour macOS

Ce guide explique comment configurer et exécuter l'environnement Heroku pour l'application entourage-job dans Docker sur macOS.

## Prérequis

- Docker Desktop pour Mac
- PostgreSQL installé et en cours d'exécution sur le port 5432
- Redis installé et en cours d'exécution sur le port 6379

## Configuration des bases de données

Pour que l'application dans le conteneur Docker puisse se connecter à PostgreSQL et Redis s'exécutant sur votre machine hôte (macOS), vous devez configurer ces services pour accepter les connexions externes.

Exécutez le script suivant pour vérifier et configurer vos bases de données :

```bash
./config-databases.sh
```

Ce script :

1. Vérifie si PostgreSQL et Redis sont installés et en cours d'exécution
2. Vérifie si la base de données 'linkedout' existe et la crée si nécessaire
3. Vous guide pour configurer PostgreSQL et Redis pour accepter les connexions depuis Docker

## Démarrage de l'environnement

Une fois les bases de données configurées, vous pouvez démarrer l'environnement Heroku :

```bash
./start.sh
```

Ce script détectera automatiquement que vous utilisez macOS et utilisera le script `start-mac.sh` qui :

1. Détecte l'adresse IP de votre machine
2. Configure les variables d'environnement pour utiliser cette adresse IP au lieu de 'localhost'
3. Démarre le conteneur Docker avec ces variables d'environnement

## Résolution des problèmes

Si l'application ne peut pas se connecter aux bases de données, vérifiez :

1. Que PostgreSQL et Redis sont en cours d'exécution sur votre machine hôte

   ```bash
   brew services list
   ```

2. Que les services sont configurés pour accepter les connexions externes

   ```bash
   cat $(brew --prefix)/etc/postgres*/postgresql.conf | grep listen_addresses
   cat $(brew --prefix)/etc/redis.conf | grep bind
   ```

3. Que les pare-feux ne bloquent pas les connexions (vérifiez les paramètres de sécurité de macOS)

4. Que l'adresse IP utilisée est correcte (vérifiez dans les logs du conteneur)

## Variables d'environnement

Les principales variables d'environnement à vérifier sont :

- `DATABASE_URL`: URL de connexion à PostgreSQL (postgres://linkedout:linkedout@[ADRESSE_IP_HOTE]:5432/linkedout)
- `DB_HOST`: Adresse IP de l'hôte
- `REDIS_URL`: URL de connexion à Redis (redis://[ADRESSE_IP_HOTE]:6379)
- `REDIS_HOST`: Adresse IP de l'hôte

Ces variables sont configurées automatiquement par le script `start-mac.sh`.
