# LinkedOut Backend

## Modules principaux & versions

```shell
   $ yarn nest info
```

| APP        | VERSION |
| ---------- | ------- |
| Node       | 16.17.0 |
| Yarn       | 1.22.19 |
| NestJS     | 9.5.0   |
| Sequelize  | 9.0.2   |
| ESLint     | .0.1    |
| TypeScript | 4.3.5   |

## Architecture (TO UPDATE)

- `.github`: configuration de la CI avec **_Github Actions_**
- `.husky` : scripts de hook de commit avec **_Husky_**
- `/public` : stockage des ressources non dynamique accessible publiquement
- `/src`
  - `/constants` : fichiers de constantes
  - `/controllers` : logiques métier de chaque use case de l'application
  - `/helpers` : fichier d'utilitaire lié aux use cases
  - `/jobs` : configuration des jobs asynchrones et gestions des jobs entrants
  - `/routes` : configuration des routes avec **Express.js**
    - `/db` : configuration de la base de données avec **Sequelize**
      - `/config` : configuration d'accès à la base de données
      - `/migrations`: fichiers de migration de la structure de la base
      - `/models` : fichiers modèles des objets en base
  - `/utils` : fonctions utilitaires communes
  - `app.js`: point d'entrée de lancement du serveur
  - `mainWorker.js`: point d'entrée de lancement du worker
  - `server.js`: gestion du serveur
- `.babelrc` : configuration pour **_Babel_**
- `.editorconfig` : configuration par défaut de la syntaxe du code de l'éditeur
- `.env` : à ajouter pour gérer les variables d'environnements ([cf. exemple](#fichier-env-minimal))
- `.eslintignore` : configuration pour **_ESLint_**
- `.eslintrc.json` : configuration pour **_ESLint_**
- `.prettierignore` : configuration pour **_Prettier_**
- `.prettierrc.json` : configuration pour **_Prettier_**
- `.sequelizerc` : configuration pour **Sequelize**
- `.slugignore` : dossiers ou fichiers à exclure du package finale pendant la compilation
- `Procfile` : configuration des process **_Heroku_** à lancer après déploiement

## Configuration

### Pré-requis

Pour lancer le projet vous avez besoin de **Docker** ainsi que de **NodeJs**.

### Installation des modules sans Docker

```shell
yarn
```

### Initialisation des modules avec Docker

:warning: il faut bien ajouter le fichier `.env` avec les variables d'environnement avant de lancer le build sur docker.

```shell
yarn
docker-compose up --build
```

Dans le cas où vous travaillez sur mac, le module Sharp peut poser problème, vous devez donc le réinstaller au sein du
container:

```shell
docker exec -it linkedout-api bash
rm -r node_modules/sharp/
npm install --platform=linux --arch=x64 sharp --legacy-peer-deps
```

### Initialisation de la BDD

#### Sans Docker

Pour créer la DB:

```shell
yarn db:create
```

Pour lancer les migrations :

```shell
yarn db:migrate
```

Pour remplir la base de données avec un utilisateur administrateur permettant la création par la suite d'autres
utilisateurs :

```shell
yarn db:seed
```

#### Avec Docker

La même chose que sans Docker, mais vous devez précéder les commandes par la suivante, et ne pas lancer la commande de
création de DB:

```shell
docker exec -it api bash
```

### Une fois la DB initialisée

Les identifiants de l'administrateur crée sont:

> Adresse mail : **admin@linkedout.fr**
> Mot de passe : **Admin123!**

### Remplir la DB avec un dump

#### Sans Docker

```shell
psql -d linkedout -p 5432 -U linkedout -W
```

Entrez le mdp de la BD (dans le docker-compose: "linkedout"), puis exécutez la commande SQL.

#### Avec Docker

Même chose que sans Docker, mais précédez par la commande suivante pour entrer dans le container de la DB:

```shell
docker exec -it db sh
```

### Lancer le projet en mode développement

#### Sans docker

```shell
yarn start:dev
```

#### Avec docker

```shell
docker-compose up
```

### Lancer le projet en mode production

```shell
yarn build
yarn start
```

### Lancement du worker (si vous n'utilisez pas Docker)

#### Mode développement

Pour pouvoir utiliser le worker en local il faut lancer une instance de **_Redis_** en
local : https://redis.io/docs/getting-started

Il faut également enlever les variables d'environnement _REDIS_URL_ et _REDIS_TLS_URL_ afin que les modules **_Redis_**
et **_Bull_** utilisent leur configuration par défaut pour se connecter à _**Redis**_ en local (`127.0.0.1:6379`)

```shell
yarn worker:start:dev
```

#### Mode production

```shell
yarn worker:start
```

### Prettier + Linter

```shell
yarn test:eslint
```

Ces deux commandes sont lancées par les hooks de commit

## Tests

### Initialisation de la BDD de test

```
docker run --name linkedout-db-test -e POSTGRES_PASSWORD=linkedout -e POSTGRES_USER=linkedout -e POSTGRES_DB=linkedout -d -p 54300:5432 postgres
```

Vous avez besoin des données du fichier `.env.test` pour les tests en local, et de renseigner le champ _DATABASE_URL_ (
_ex:_ `postgresql://linkedout:linkedout@localhost:54300/linkedout`) avec l'adresse de l'instance **_Docker_**

```
NODE_ENV=dev-test yarn db:migrate
```

### Lancer les tests

- `yarn test:e2e` est utilisé pour l'intégration continue pour lancer les tests avec les valeurs du fichier `.env`
- `NODE_ENV=dev-test yarn test:e2e` pour lancer les tests en local, en utilisant le fichier `.env.test`

## Déploiement

Le déploiement se fait automatiquement grâce à **_Github Actions_** et **_Heroku_**.

Si un commit est poussé sur `develop`, l'application sera déployé sur la pre-production : \* \*[https://entourage-job-preprod.herokuapp.com](https://entourage-job-preprod.herokuapp.com)\*\*

Si un commit est poussé sur `master`, l'application sera déployé sur la production : \* \*[https://api.linkedout.fr](https://api.linkedout.fr)\*\*

Les tests sont effectués sur **_Github Actions_** avant de déployer le projet sur **_Heroku_**.

## Stack technique

![Stack technique LinkedOut](./stack.svg)
