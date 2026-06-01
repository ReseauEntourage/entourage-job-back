---
name: tech-arch
description: Generate or update TECH_ARCH.md with Mermaid architecture diagrams for the entourage-job-back NestJS repo. Use when the user asks to "update the architecture", "regenerate TECH_ARCH", "refresh the arch diagram", or when new modules, services or external dependencies have been added.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, Agent
---

Generate or update `TECH_ARCH.md` at the root of the entourage-job-back repo with up-to-date Mermaid architecture diagrams.

## Goal

Produce a `TECH_ARCH.md` that contains:
1. A **simplified overview diagram** (high-level, nodes grouped by layer, no labels on arrows)
2. A **detailed diagram** (all NestJS modules, queues, cron jobs, external services with labeled data flows)
3. A **BullMQ queues table** (all queues with their jobs and processors)
4. A **cron jobs table** (all scheduled tasks with schedule and description)
5. An **external services table** (role, auth, used by)
6. An **infrastructure section** (runtime, framework versions, database, cache, secrets)

## Steps

### 1. Discover the module structure

Read the two root modules to understand what runs in each process:
- `src/app.module.ts` — HTTP API process (all business modules + guards + interceptors)
- `src/worker.module.ts` — Background worker process (ConsumersModule + CronModule)
List domain modules:
```bash
ls src/
ls src/external-services/
ls src/queues/consumers/
```

### 2. Extract queue and job definitions

Read `src/queues/queues.types.ts` — it defines:
- All **queue names** (`Queues` const)
- All **job names** (`Jobs` const) grouped by: profile-generation, worker, cron-tasks, embedding
- All **job payload types**

Read each processor to understand what it does:
- `src/queues/consumers/work-queue.processor.ts` — handles `WORK` queue
- `src/queues/consumers/profile-generator.processor.ts` — handles `PROFILE_GENERATION` queue
- `src/queues/consumers/embedding-queue.processor.ts` — handles `EMBEDDING` queue
- `src/queues/consumers/cron-tasks/cron-tasks.processor.ts` — handles `CRON_TASKS` queue

### 3. Extract cron schedules

Read `src/cron/cron.service.ts` — it enqueues jobs on `@Cron()` schedules.
Map each cron method to its schedule expression and the job it enqueues.

### 4. Identify external services

From `src/external-services/` subdirectories and env var patterns:
- **AWS S3** (`src/external-services/aws/s3.service.ts`) — file storage (CVs, logos, media)
- **AWS CloudFront** (`src/external-services/aws/cloud-front.service.ts`) — CDN cache invalidation
- **OpenAI** (`src/external-services/openai/`) — CV extraction (vision), profile generation
- **VoyageAI** (`src/external-services/voyageai/`) — text embeddings
- **Salesforce** (`src/external-services/salesforce/`) — CRM sync (users, companies)
- **Mailjet** (`src/external-services/mailjet/`) — transactional email templates
- **Mailchimp** — newsletter subscription management
- **Pusher** (`src/external-services/pusher/`) — real-time push notifications to frontend
- **Slack** (`src/external-services/slack/`) — internal team notifications
- **PostgreSQL** — primary database (via Sequelize)
- **Redis** (`src/redis/`) — BullMQ backing store + response cache

### 5. Write the simplified diagram

```mermaid
graph LR
    subgraph API["HTTP API (NestJS)"]
        direction TB
        ... one node per major domain group ...
    end

    subgraph Worker["Background Worker (NestJS)"]
        direction TB
        ... queue processors + cron ...
    end

    subgraph AWS["AWS"]
        S3 ~~~ CloudFront
    end

    subgraph AI["AI"]
        OpenAI ~~~ VoyageAI
    end

    subgraph Autres["Services externes"]
        Salesforce ~~~ Mailjet ~~~ Mailchimp ~~~ Pusher ~~~ Slack
    end

    DB[(PostgreSQL)]
    REDIS[(Redis)]

    ... arrows without labels ...

    style API fill:#E8F5E9,stroke:#388E3C
    style Worker fill:#E3F2FD,stroke:#1976D2
    style AWS fill:#FFE0B2,stroke:#FF9900
    style AI fill:#F3E5F5,stroke:#7B1FA2
```

Rules for the simplified diagram:
- **No labels on arrows** — plain `-->` and `<-->` only
- API process (green `#E8F5E9`) and Worker process (blue `#E3F2FD`) as the two main boxes
- AWS resources grouped in `AWS` subgraph on one line via `~~~`
- AI services grouped in `AI` subgraph on one line via `~~~`
- Other external services in `Autres` on one line via `~~~`
- Database and Redis as cylinder nodes `[(name)]`

### 6. Write the detailed diagram

```mermaid
graph TB
    subgraph API["HTTP API — NestJS 9 / Node 20"]
        subgraph Auth["Auth & Security"]   ... JWT guard, throttler, API keys ...
        subgraph Users["Users & Profiles"] ... users, user-profiles, user-social-situations ...
        subgraph Social["Social / Matching"] ... messaging, contacts, events, recommendations ...
        subgraph Companies["Companies"]    ... companies, recruitement-alerts ...
        subgraph Content["Content & CV"]   ... public-cv, external-cvs, read-documents, elearning ...
        subgraph Admin["Admin"]            ... organizations, revisions, sessions, stats ...
    end

    subgraph Worker["Background Worker"]
        subgraph Queues["BullMQ Queues"]
            WORK["work queue\n(mail, SF sync, onboarding)"]
            PROFGEN["profile-generation queue\n(PDF → AI profile)"]
            EMBED["embedding queue\n(VoyageAI vectors)"]
            CRON_Q["cron-tasks queue\n(scheduled jobs)"]
        end
        subgraph Cron["Cron Triggers (NestJS Schedule)"]
            ... one node per @Cron with schedule time ...
        end
    end

    subgraph Infra["Infrastructure"]
        PG[(PostgreSQL)]
        REDIS[(Redis TLS)]
        S3["AWS S3\n(CVs, logos, media)"]
        CF["AWS CloudFront\n(CDN)"]
    end

    subgraph External["Services externes"]
        SF["Salesforce CRM"]
        MJ["Mailjet\n(transactional email)"]
        MC["Mailchimp\n(newsletter)"]
        OAI["OpenAI\n(vision + chat)"]
        VAI["VoyageAI\n(embeddings)"]
        PUSHER["Pusher\n(real-time)"]
        SLACK["Slack\n(internal alerts)"]
    end

    ... all arrows with labels ...
```

Rules for the detailed diagram:
- Group API routes by domain cluster (Auth, Users, Social, Companies, Content, Admin)
- Show queue names and their primary job types in node labels
- Show cron schedules in node labels (e.g. `\n10:00 UTC daily`)
- Use `-->|"label"|` syntax for labeled arrows
- Use `-.->` for async/queue relationships
- Use `==>` for critical data flows (DB reads/writes)

### 7. Write the BullMQ queues table

Columns: Queue | Job | Processor | Description

List every job from `src/queues/queues.types.ts` mapped to its processor. Group by queue.

### 8. Write the cron jobs table

Columns: Méthode | Schedule | Heure UTC | Description

Source from `src/cron/cron.service.ts`. Convert `CronExpression` constants to human-readable UTC times.

Known mappings:
- `EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT` → `0 0 1 * *` → 1st of month, 00:00 UTC
- `EVERY_DAY_AT_9AM` → `0 9 * * *` → 09:00 UTC daily
- `EVERY_DAY_AT_10AM` → `0 10 * * *` → 10:00 UTC daily
- `EVERY_DAY_AT_NOON` → `0 12 * * *` → 12:00 UTC daily
- `EVERY_DAY_AT_2AM` → `0 2 * * *` → 02:00 UTC daily
- `'0 3 * * *'` → 03:00 UTC daily

### 9. Write the external services table

Columns: Service | Rôle | Authentification | Utilisé par (module)

### 10. Write the infrastructure section

- **Runtime**: Node.js 20.x
- **Framework**: NestJS 9
- **Processes**: Two — HTTP API (`src/main.ts`) and Background Worker (`src/worker.ts`)
- **Database**: PostgreSQL via Sequelize 6 + sequelize-typescript (migrations in `src/db/migrations/`)
- **Cache**: Redis (TLS) via ioredis + cache-manager-ioredis
- **Queue engine**: BullMQ 5 with 4 named queues
- **Cron**: `@nestjs/schedule` (node-cron under the hood), runs in the Worker process
- **AI**: OpenAI SDK v4, VoyageAI SDK — both async via embedding/profile-generation queues
- **Monitoring**: Datadog APM (`dd-trace`) initialized in `src/tracer.ts`
- **Auth**: JWT (passport-jwt) + local strategy; API-key guard for worker endpoints
- **Secrets**: Environment variables (`.env` / Heroku config vars)
- **Package manager**: pnpm
- **Build**: NestJS CLI (webpack + ts-loader), separate configs for API and Worker (`nest-cli.worker.json`)

### 11. Update TECH_ARCH.md

Rewrite the file with all sections in order:
1. Title + one-sentence intro
2. `## Aperçu simplifié` + simplified diagram
3. `## Vue d'ensemble détaillée` + detailed diagram
4. `## Queues BullMQ` + table
5. `## Tâches planifiées (Cron)` + table
6. `## Services externes` + table
7. `## Infrastructure` + bullet list

Write in French. Keep diagrams valid Mermaid (test node IDs — no spaces, no special chars unquoted).
