# Entourage Pro — Backend

[![Entourage Pro - Back CI](https://github.com/ReseauEntourage/entourage-job-back/actions/workflows/ci.yml/badge.svg)](https://github.com/ReseauEntourage/entourage-job-back/actions/workflows/ci.yml)

API REST et worker asynchrone d'**Entourage Pro**, le premier réseau professionnel solidaire : la plateforme met en relation des **candidats** en recherche d'emploi et en manque de réseau, des **coachs** bénévoles, des **prescripteurs** (structures d'accompagnement) et des **entreprises** partenaires.

Stack : **NestJS 11** · **TypeScript 6** · **PostgreSQL 17 + pgvector** · **Sequelize** · **Redis + BullMQ** · **Node 24**

| | |
|---|---|
| **Frontend** | [`entourage-job-front`](https://github.com/ReseauEntourage/entourage-job-front) (Next.js) — à mettre à jour en parallèle dès qu'un contrat d'API change |
| **Doc API** | Swagger sur `/api` (si `ENABLE_SWAGGER=true`) |
| **Doc technique** | [OVERVIEW.md](OVERVIEW.md) · [TECH_ARCH.md](TECH_ARCH.md) · [LIBRARIES.md](LIBRARIES.md) · [docs/](docs/) |
| **Guide Claude Code** | [CLAUDE.md](CLAUDE.md) |

---

## Démarrage rapide

**Pré-requis :** **Docker** (avec Compose) et **Node.js** `24.15.0` (voir [.nvmrc](.nvmrc)) — plus **pnpm** `11.15.0` si tu travailles hors conteneur.

```bash
cp .env.dist .env          # variables de l'API et du worker
cp .env.dist .env.test     # variables utilisées par la suite e2e
pnpm all:dev:docker:build  # API + worker + Postgres + Redis + agent Datadog
```

Les deux fichiers sont à créer soi-même et ne sont **pas** versionnés ; voir [« Configuration »](#configuration) pour ce qu'il faut remplir.

L'API écoute sur **http://localhost:3002**, Swagger sur **http://localhost:3002/api**.

Le premier lancement construit l'image, installe les dépendances dans le volume et démarre en mode watch. Les migrations ne sont **pas** jouées automatiquement en local :

```bash
docker exec api pnpm db:create   # si la base n'existe pas encore
docker exec api pnpm db:migrate
docker exec api pnpm db:seed     # admin + référentiels (secteurs, métiers, langues, départements…)
```

Le seeder crée un compte administrateur utilisable immédiatement :

> **Email** : `admin@entourage.social`
> **Mot de passe** : `Admin123!`

### Sans Docker

Nécessite un Postgres 17 avec l'extension `vector` et un Redis joignables via `DATABASE_URL` / `REDIS_URL`.

```bash
pnpm install
pnpm db:migrate
pnpm api:dev      # API en watch
pnpm worker:dev   # worker en watch (autre terminal)
```

### Compiler et lancer comme en production

```bash
pnpm build        # nest build → dist/
pnpm api:start    # node dist/main
pnpm worker:start # node dist/worker
```

### Charger un dump SQL dans la base de dev

```bash
docker exec -i db psql -U entourage_pro -d entourage_pro < dump.sql
```

Ou en interactif (mot de passe : `entourage_pro`, cf. [docker-compose.yml](docker-compose.yml)) :

```bash
docker exec -it db sh
psql -d entourage_pro -p 5432 -U entourage_pro -W
```

---

## Les deux processus

Le repo produit **deux applications** à partir de la même base de code, avec deux racines de modules distinctes :

| Processus | Entrée | Module racine | Rôle |
|---|---|---|---|
| **API** | [src/main.ts](src/main.ts) | [`AppModule`](src/app.module.ts) | HTTP : controllers, auth JWT, throttling, Swagger, producteurs de jobs |
| **Worker** | [src/worker.ts](src/worker.ts) | [`WorkerModule`](src/worker.module.ts) | Consommateurs BullMQ + `@nestjs/schedule` — aucun port ouvert |

Le worker partage la configuration Sequelize de l'API (`getSequelizeOptions()` exporté par `app.module.ts`) avec un pool élargi (`max: 10`), et n'importe que `ConsumersModule` + `CronModule`.

Sur Heroku, les trois process du [Procfile](Procfile) : `release` (migrations), `web` (API), `mainWorker` (worker).

```bash
pnpm api:dev:docker      # API seule (+ db, redis, datadog)
pnpm worker:dev:docker   # API + worker
pnpm all:dev:docker      # idem, alias explicite
```

---

## Architecture

### Organisation du code

Un dossier par domaine sous [src/](src/), chacun suivant la même convention :

```
src/<domain>/
├── <domain>.module.ts        # câblage NestJS
├── <domain>.controller.ts    # routes HTTP
├── <domain>.service.ts       # logique métier
├── <domain>.types.ts         # enums, unions, types partagés
├── <domain>.utils.ts         # helpers purs
├── <domain>.attributes.ts    # listes d'attributs Sequelize réutilisables
├── <domain>.includes.ts      # includes Sequelize réutilisables
├── dto/                      # DTO validés par class-validator
└── models/                   # modèles sequelize-typescript
```

Le domaine **utilisateur** est volontairement éclaté en modules à responsabilité unique plutôt qu'en un gros `UsersModule` — `users`, `users-creation`, `users-deletion`, `users-stats`, `user-profiles`, et une famille `user-profile-*` (experiences, formations, skills, languages, interests, media, embeddings, recommendations, moderation, analytics, contracts, nudges, shares, sector-occupations…).

Les intégrations tierces sont regroupées sous [src/external-services/](src/external-services/) : `mailjet`, `salesforce`, `slack`, `vonage`, `pusher`, `openai`, `anthropic`, `voyageai`, `linkedin`, `shortio`, `aws`, plus l'observabilité LLM (`ai-observability`, `llm-metrics`).

À côté des dossiers de domaine, [src/](src/) contient :

| Fichier / dossier | Rôle |
|---|---|
| [app.module.ts](src/app.module.ts) | Module racine de l'API — expose aussi `getSequelizeOptions()` et `getRedisOptions()`, réutilisés par le worker |
| [worker.module.ts](src/worker.module.ts) | Module racine du worker |
| [main.ts](src/main.ts) / [worker.ts](src/worker.ts) | Les deux points d'entrée |
| [tracer.ts](src/tracer.ts) | Initialisation de l'APM Datadog — **doit** rester le premier import des deux entrées |
| [logging.interceptor.ts](src/logging.interceptor.ts) | Log des requêtes HTTP |
| [src/db/](src/db/) | `config/` (accès Sequelize), `migrations/`, `models/`, `seeders/` |
| [src/utils/](src/utils/) | Types et helpers transverses (zones, filtres, validation…) |
| [src/common/](src/common/) | Décorateurs, interceptors et module `reviews` partagés |

### Principaux domaines fonctionnels

| Domaine | Ce qu'il couvre |
|---|---|
| `auth` / `current-user` | Inscription, login, JWT, reset de mot de passe, permissions |
| `user-profiles` | Profil public, annuaire, disponibilité, complétion |
| `user-profile-recommendations` | Recommandations de profils par similarité vectorielle |
| `messaging` | Messagerie interne (conversations, participants, notifications) — voir [docs/messaging.md](docs/messaging.md) |
| `ai-assistant` | Assistant de coaching pour les coachs — voir [docs/ai-assistant.md](docs/ai-assistant.md) |
| `profile-generation` / `read-documents` | Extraction de CV PDF → profil — voir [docs/cv-extraction.md](docs/cv-extraction.md) |
| `companies` | Entreprises partenaires, membres, invitations |
| `recruitement-alerts` | Alertes de recrutement et mises en relation |
| `gamification` | Achievements, engagement, expirations |
| `elearning` | Parcours et complétions de formation |
| `public-cv` / `external-cvs` | CV publics et CV externes attachés au profil |
| `events`, `nudge`, `medias`, `revisions`, `feature-flags` | Briques transverses |
| `business-sectors`, `occupations`, `contracts`, `languages`, `skills`, `passions`, `interests`, `locations`, `departments` | Référentiels |

### Sécurité des routes

`JwtAuthGuard` est monté en **guard global** (`APP_GUARD`) : toute route est authentifiée par défaut. Une route publique doit être explicitement annotée avec le décorateur `@Public()` ([src/auth/guards/public.decorator.ts](src/auth/guards/public.decorator.ts)).

Sont également globaux : `ThrottlerGuard` (100 requêtes / 60 s), `TimeoutInterceptor` (ajustable par route via `@Timeout()`) et un `LoggingInterceptor`.

**Rôles** (`UserRoles`) : `Candidat`, `Coach`, `Prescripteur`, `Admin`.
**Permissions** (`Permissions`) : les mêmes, plus `Restricted_Coach` — un `Coach` porte `[Coach, Restricted_Coach]`. Voir [src/users/users.types.ts](src/users/users.types.ts).

### Recherche vectorielle

Postgres tourne sur l'image `pgvector/pgvector:pg17`. Les embeddings de profils sont produits via **VoyageAI** (`voyage-4-lite`, 1024 dimensions), stockés dans `UserProfileEmbeddings` et interrogés par un index **HNSW** (`embedding <=>`). Deux types d'embeddings : `profile` et `needs`.

Le score de recommandation combine `profil (40 %) + besoins (20 %) + activité (30 %) + compatibilité géographique (10 %)`. Détails et paramétrage : [docs/profile-recommendations.md](docs/profile-recommendations.md).

---

## Jobs asynchrones et tâches planifiées

Quatre files BullMQ sur Redis, déclarées dans [src/queues/queues.utils.ts](src/queues/queues.utils.ts) :

| File | Processeur | Contenu |
|---|---|---|
| `work` | [work-queue.processor.ts](src/queues/consumers/work-queue.processor.ts) | Mails, SMS, synchronisation Salesforce, newsletter, onboarding |
| `cron-tasks` | [cron-tasks.processor.ts](src/queues/consumers/cron-tasks/cron-tasks.processor.ts) | Toutes les campagnes de relance et de nettoyage |
| `profile-generation` | [profile-generator.processor.ts](src/queues/consumers/profile-generator.processor.ts) | Génération de profil depuis un CV PDF |
| `embedding` | [embedding-queue.processor.ts](src/queues/consumers/embedding-queue.processor.ts) | Calcul d'embeddings, unitaire et par lot |

Les noms de jobs sont centralisés dans l'objet `Jobs` de [src/queues/queues.types.ts](src/queues/queues.types.ts).

[`CronService`](src/cron/cron.service.ts) porte une trentaine de `@Cron` qui, plutôt que d'exécuter le travail en ligne, **poussent un job dans la file `cron-tasks`** — relances d'onboarding incomplet, mails de recommandation, passage automatique en indisponible, expiration d'achievements, suppression des comptes inactifs, alertes de recrutement, feedbacks… `CronTasksSlackReporterService` publie un compte-rendu d'exécution sur Slack.

### Monitoring des files

**Bull Board** est monté sur **http://localhost:3002/queues** dès que `QUEUES_ADMIN_PASSWORD` est défini — il permet d'inspecter les jobs actifs, en attente, terminés et échoués, et de les relancer.

> **Identifiant** : `admin`
> **Mot de passe** : la valeur de `QUEUES_ADMIN_PASSWORD` dans le `.env`

---

## Base de données

Sequelize + `sequelize-typescript`, ~59 modèles, 175 migrations. La configuration CLI vit dans [.sequelizerc](.sequelizerc) / [src/db/config/config.js](src/db/config/config.js) et lit `DATABASE_URL` (`.env`, ou `.env.test` quand `NODE_ENV=dev-test`).

```bash
pnpm db:create        # créer la base
pnpm db:migrate       # appliquer les migrations
pnpm db:migrate:undo  # annuler la dernière
pnpm db:seed          # jouer les seeders
pnpm db:dump          # dumper le schéma
pnpm db:drop          # supprimer la base
```

`autoLoadModels: true` — les modèles sont enregistrés par leurs modules, mais **jamais synchronisés automatiquement** : tout changement de schéma passe par une migration.

---

## Tests

```bash
pnpm test              # ts-check + eslint + e2e, dans cet ordre
pnpm test:ts-check     # tsc --noEmit
pnpm test:eslint       # eslint --fix, zéro warning toléré
```

La suite est essentiellement **end-to-end** (Jest + supertest, [tests/](tests/)) : chaque spec démarre un module de test complet ([tests/custom-testing.module.ts](tests/custom-testing.module.ts)), remplit la base via des factories `@faker-js/faker` ([tests/test-data/](tests/test-data/)) et tape les vraies routes HTTP. [tests/database.helper.ts](tests/database.helper.ts) gère le reset et les interactions bas niveau avec la base, [tests/mocks.types.ts](tests/mocks.types.ts) définit les mocks de services externes.

### Avec Docker — voie recommandée

```bash
pnpm test:e2e:docker                                    # toute la suite
pnpm test:e2e:docker -- tests/users/users.e2e-spec.ts   # un fichier
pnpm test:e2e:docker -- -t "should return 403"          # filtrage par nom de test
```

Le script lance un conteneur `api-test` jetable, câblé sur le Postgres `db-test` et alimenté par `.env.test`. Son entrypoint ([docker-entrypoint.test.sh](docker-entrypoint.test.sh)) enchaîne : installation des dépendances → `db:drop` → `db:create` → `db:migrate` sur la branche courante → exécution des specs. Aucune initialisation manuelle n'est donc nécessaire.

### En local, hors Docker

Renseigner `DATABASE_URL` dans `.env.test` avec l'adresse du Postgres de test — `db-test` est exposé sur le port **5433** de l'hôte (cf. [docker-compose.test.yml](docker-compose.test.yml)) :

```
DATABASE_URL=postgres://entourage_pro:entourage_pro@localhost:5433/entourage_pro_test
```

Puis, la base une fois créée et migrée :

```bash
pnpm test:e2e {chemin du fichier} {-t "Nom du test"}
```

---

## Configuration

Toutes les variables sont listées dans [.env.dist](.env.dist), à copier en `.env` (et `.env.test` pour les tests). Les grandes familles :

| Famille | Variables |
|---|---|
| **Application** | `PORT`, `NODE_ENV`, `FRONT_URL`, `ENABLE_SWAGGER`, `SERVER_TIMEOUT` |
| **Infra** | `DATABASE_URL`, `REDIS_URL` / `REDIS_TLS_URL`, `JWT_SECRET` |
| **Worker** | `DEBUG_JOBS`, `JOBS_BACKOFF_DELAY`, `QUEUES_ADMIN_PASSWORD` |
| **Stockage AWS** | `AWSS3_*`, `CDN_ID`, `CV_PDF_GENERATION_AWS_URL` |
| **Mail (Mailjet)** | `MAILJET_*`, `FIXIE_URL`, et les `STAFF_CONTACT_*` par territoire |
| **SMS / temps réel** | `VONAGE_API_*`, `PUSHER_*` |
| **IA** | `OPENAI_API_KEY`, `OPENAI_MAX_COMPLETION_TOKENS`, `ANTHROPIC_API_KEY`, `VOYAGEAI_API_KEY` |
| **CRM** | `ENABLE_SF`, `SALESFORCE_*`, `SF_*` |
| **Divers** | `SLACK_*`, `SHORTIO_*`, `LINKEDIN_*`, `WHATSAPP_*_URL_*`, `TOOLBOX_*_URL` |
| **Observabilité** | `DD_*` (Datadog APM via [src/tracer.ts](src/tracer.ts), importé en tout premier dans `main.ts` et `worker.ts`) |

`ENABLE_SF=false` et `OPENAI_API_KEY` vide permettent de travailler en local sans consommer les intégrations payantes.

Les territoires couverts (`ZoneName`) structurent une partie de la configuration : Paris, Lyon, Lille, Lorient, Rennes, Sud-Ouest, et hors-zone (`HZ`).

---

## Conventions

- **Commentaires et JSDoc en anglais**, quelle que soit la langue de la PR ou de la conversation.
- Un domaine = un module ; pas de service transverse fourre-tout. Préférer un nouveau module à responsabilité unique.
- Les DTO valident les entrées (`class-validator` + `class-transformer`) ; les controllers restent fins, la logique va dans les services.
- Les `attributes.ts` / `includes.ts` évitent la duplication des `attributes` et `include` Sequelize entre requêtes.
- Toute modification de schéma passe par une migration versionnée.
- Dépendances circulaires : `UserProfilesService` ↔ `UserProfileRecommendationsService` s'injectent mutuellement via `forwardRef` **des deux côtés** — ne pas retirer les wrappers.
- **Cross-repo** : un changement de contrat d'API se fait dans la même session côté `entourage-job-front` (`src/api/types.ts` + saga/hook consommateur).

Formatage et lint sont appliqués au commit : le hook [.husky/pre-commit](.husky/pre-commit) lance `lint-staged`, qui déclenche `test:ts-check` puis `test:eslint` sur les fichiers `.ts` mis en scène ([.lintstagedrc.js](.lintstagedrc.js)).

```bash
pnpm format   # prettier sur src/ et tests/
```

### Outillage à la racine

| Fichier | Rôle |
|---|---|
| [package.json](package.json) · [pnpm-lock.yaml](pnpm-lock.yaml) · [pnpm-workspace.yaml](pnpm-workspace.yaml) | Dépendances, versions verrouillées, plateformes et scripts de build autorisés |
| [tsconfig.json](tsconfig.json) · [tsconfig.build.json](tsconfig.build.json) · [tsconfig.eslint.json](tsconfig.eslint.json) | TypeScript : édition, build, lint |
| [eslint.config.mjs](eslint.config.mjs) · [.prettierrc](.prettierrc) · [.editorconfig](.editorconfig) | Lint et formatage |
| [nest-cli.json](nest-cli.json) · [nest-cli.worker.json](nest-cli.worker.json) | Config Nest CLI de l'API (avec le plugin Swagger) et du worker |
| [.sequelizerc](.sequelizerc) | Chemins que la CLI Sequelize doit utiliser dans `src/db/` |
| [Dockerfile](Dockerfile) · [.dockerignore](.dockerignore) | Image de base commune aux trois conteneurs Node |
| [docker-compose.yml](docker-compose.yml) · [docker-compose.worker.yml](docker-compose.worker.yml) · [docker-compose.test.yml](docker-compose.test.yml) | Stack de dev, surcouche worker, stack de test |
| [docker-entrypoint.sh](docker-entrypoint.sh) · [docker-entrypoint.worker.sh](docker-entrypoint.worker.sh) · [docker-entrypoint.test.sh](docker-entrypoint.test.sh) | Entrypoints correspondants |
| [dump-db-schema.sh](dump-db-schema.sh) | Génère un dump de la structure de la base (`pnpm db:dump`) |
| [Procfile](Procfile) | Process Heroku lancés après déploiement |

---

## CI/CD et déploiement

[.github/workflows/ci.yml](.github/workflows/ci.yml) — sur chaque PR et sur `master` / `develop` : `setup` → `ts-check`, `lint`, `build` en parallèle → `e2e` contre un service Postgres `pgvector/pgvector:pg17`. Les variables nécessaires aux tests sont déclarées dans le workflow et alimentées par les **secrets du repository GitHub** (environnement `entourage-job-back-test`).

[.github/workflows/release.yml](.github/workflows/release.yml) — une PR vers `master` déclenche un bump de version et un tag. Le type est piloté par les labels de la PR : `release:major`, `release:minor`, sinon `patch`.

Le déploiement est automatique via **GitHub Actions** et **Heroku**, une fois les tests passés :

| Branche | Environnement | URL |
|---|---|---|
| `develop` | Pré-production | https://entourage-job-preprod.herokuapp.com |
| `master` | Production | https://api.entourage-pro.fr |

Sur chaque déploiement, la phase `release` du [Procfile](Procfile) applique les migrations avant le démarrage des dynos `web` et `mainWorker`.

---

## Stack technique

![Stack technique Entourage Pro](./stack.svg)

---

## Licence

ISC — voir [LICENSE](LICENSE).
