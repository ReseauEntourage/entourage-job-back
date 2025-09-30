# LinkedOut Backend

Document mis à jour le 05/09/2025

[![LinkedOut Backend Test](https://github.com/ReseauEntourage/entourage-job-back/actions/workflows/main.yml/badge.svg)](https://github.com/ReseauEntourage/entourage-job-back/actions/workflows/main.yml)

## Modules principaux & versions

| App            | Version |
| -------------- | ------- |
| **Node**       | 20.x.x  |
| **NestJS**     | 9.4.1   |
| **Sequelize**  | 9.0.2   |
| **ESLint**     | 8.0.1   |
| **TypeScript** | 4.3.5   |
| **esLint**     | 8.0.1   |

## Architecture

- `.github`: configuration de la CI avec **_Github Actions_**
- `.husky` : scripts de hook de commit avec **_Husky_**
- `/public` : stockage des ressources non dynamique accessible publiquement
- `/src` : dossier contenant toutes les sources des différents modules de l'application
  - `/api-keys` : module de gestion de l'authentification par clé API
  - `/db` : configuration de la base de données avec **Sequelize**
    - `/config` : configuration d'accès à la base de données
    - `/migrations`: fichiers de migration de la structure de la base
    - `/seeders` : fichiers de seeds pour générer des données dans la base de donnée
    - (...) Les modules de l'application
  - `/utils` : fonctions utilitaires communes
  - `app.module.ts`: Module global de l'application
  - `tracer.ts`: fichier d'initialisation de la connexion à DataDog
  - `main.ts`: point d'entrée de lancement du serveur
  - `worker.module.ts`: Module global du worker
- `/tests`: L'ensemble des tests e2e par module
  - (...) Les différents modules testés
  - custom-testing.module.ts: Le module de test
  - database.helper.ts: Helper permettant les interactions avec la base de donnée
  - jest-e2e.json: Fichier de configuration de Jest
  - mocks.types.ts: Fichier de définition des Mock de services
- `.dockerignore`: Les fichiers qui seront ignorés dans Docker
- `.env` : à ajouter pour gérer les variables d'environnements ([cf. exemple](#fichier-env-minimal))
- `.env.test` : à ajouter pour gérer les variables d'environnements dans le cadre des tests en local
- `.env.dist`: fichier de distribution des variables d'env
- `.eslintrc.js` : configuration pour **_eslint_**
- `.gitignore` : Configuration des fichiers qui ignorés par Git
- `.lintstagedrc.js` : configuration pour **_lint-stagged_**
- `.prettierrc.json` : configuration pour **_Prettier_**
- `.sequelizerc` : configuration pour **Sequelize**
- `docker-compose.yml`: Définition des différents containers Docker pour le développement local
- `docker-entrypoint.sh`: Point d'entrée de lancement de l'app avec Docker
- `Dockerfile`: configuration du container Docker de l'application
- `nest-cli.json`: configuration de _*nest*_ pour l'app
- `nest-cli.worker.json`: configuration de _*nest*_ pour le worker
- `package.json`: configuration du projet et des dépendances
- `Procfile` : configuration des process **_Heroku_** à lancer après déploiement
- `tsconfig.json`: configuration pour _*typescript*_
- `yarn.lock`: définitions des dépendances et sous dépendances et leur version

## Configuration

### Pré-requis

Pour lancer le projet vous avez besoin de **Docker** ainsi que de **NodeJs**.

### Définition des variables d'environnement

Veuillez consulter le fichier .env.dist pour connaitre les variables d'environnement utilisés dans le projet.
Vous devez définir deux nouveaux fichiers de variables d'environnement :

- un fichier `.env` pour les variables d'environnement de l'application en mode `run`
- un fichier `.env.test` pour les variables d'environnement de l'application en mode `test`

### Configuration de l'authentification par clé API

Pour utiliser l'authentification par clé API :

1. Ajoutez une clé API à votre fichier `.env` :

```
MAILER_API_KEY=your_secure_api_key_here
```

2. Pour les requêtes authentifiées, incluez l'en-tête HTTP `X-API-Key` avec la valeur de votre clé API.

### Initialisation des containers

Création des containers de l'application

```
docker-compose up --build
```

Dans le cas où vous travaillez sur mac, le module Sharp peut poser problème, vous devez donc le réinstaller au sein des
containers:

```
docker exec -it linkedout-api-worker bash
rm -r node_modules/sharp/
npm install --platform=linux --arch=x64 sharp --legacy-peer-deps
exit
```

```
docker exec -it linkedout-api-test bash
rm -r node_modules/sharp/
npm install --platform=linux --arch=x64 sharp --legacy-peer-deps
exit
```

### Initialisation de la BDD

Entrez dans votre container

```
docker exec -it linkedout-api-worker bash
```

Pour créer la DB:

```
yarn db:create
```

Pour lancer les migrations :

```
yarn db:migrate
```

Pour remplir la base de données avec un utilisateur administrateur permettant la création par la suite d'autres
utilisateurs :

```
yarn db:seed
```

### Une fois la DB initialisée

Les identifiants de l'administrateur crée sont :

> Adresse mail : **admin@linkedout.fr**
>
> Mot de passe : **Admin123!**

### Remplir la DB avec un dump

```
docker exec -it linkedout-db sh
psql -d linkedout -p 5432 -U linkedout -W
```

Entrez le mdp de la BD (dans le docker compose: "linkedout"), puis exécutez la commande SQL.

### Lancer le projet en mode développement

```
docker compose up
```

### Lancer le projet en mode production

- Compiler l'application

```
yarn build
```

- Démarrer l'application précédemment compilé

```
yarn start
```

- Démarrer le worker

```
yarn worker:start:dev
```

#### Mode production

```
yarn worker:start
```

### Prettier + Linter

```
yarn test:eslint
```

> Ces deux commandes sont lancées par les hooks de commit.

## Tests

## Initialisation de la BDD de test

Vous avez besoin des données du fichier `.env.test` pour les tests en local, et de renseigner le champ _DATABASE_URL_ (
_ex:_ `postgresql://linkedout:linkedout@localhost:54300/linkedout`) avec l'adresse de l'instance **_Docker_**

## Lancer les tests

### En local, sur votre machine directement

- Assurez vous d'avoir initialisé les migrations

```
$> docker exec -it linkedout-api-test sh
```

- Executez les tests e2e

```
$> yarn run test:e2e {optionnel: test file path} {optionnel: -t "Name of test"}
```

### Avec docker

- L'initialisation de la base de donnée pour les tests est automatique **_avec Docker_**, et il utilise les informations contenues dans .env.test.

  Le script docker-entrypoint.test.sh est executé, il commence par supprimer la base existante, la recréé, lance toutes les migrations de la branche courante et enfin execute les tests e2e.

```
$> docker compose -f docker-compose.test.yml run --rm linkedout-api-test {optionnel: test file path} {optionnel: -t "Name of test"}
```

# Déploiement

Le déploiement se fait automatiquement grâce à **_Github Actions_** et **_Heroku_**.

Si un commit est poussé sur `develop`, l'application sera déployé sur la pre-production : \* \*[https://entourage-job-preprod.herokuapp.com](https://entourage-job-preprod.herokuapp.com)\*\*

Si un commit est poussé sur `master`, l'application sera déployé sur la production : \* \*[https://api.linkedout.fr](https://api.linkedout.fr)\*\*

Les tests sont effectués sur **_Github Actions_** avant de déployer le projet sur **_Heroku_**
(Les variables nécessaires pour executer les tests sont définies dans main.yaml et set dans les paramètres de secrets du repository sur GitHub)

## Stack technique

![Stack technique LinkedOut](./stack.svg)
