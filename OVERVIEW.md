# entourage-job-back — overview

> Added by the `entourage_specs` meta-repo. The submodule's own canonical README lives at `README.md`.

The PRO product backend. NestJS 9 + Sequelize 6 (PostgreSQL) + BullMQ (Redis) + Pusher. REST API for candidates/coaches/companies/admin, plus a separate worker process for asynchronous jobs (CV PDF rendering, AI-assisted profile recommendations, Salesforce sync, scheduled emails, Slack queue reports). Hosted on Heroku — `web` + `mainWorker` dynos. CI/CD via GitHub Actions.

## Interactions

```
   front  ──HTTPS REST + Pusher──►  job-back (web)  ◄──BullMQ──►  job-back (worker)
                                       │                              │
                                       └────────► PostgreSQL ◄────────┘
                                       └────────► Redis     ◄────────┘
                                       └────────► AWS S3 + CloudFront (CV PDFs, images)
                                       └────────► Salesforce  (jsforce, OAuth client-credentials)
                                       └────────► Mailjet     (transactional + Mailchimp newsletter)
                                       └────────► Slack       (@slack/bolt — scheduled queue reports)
                                       └────────► Pusher      (server SDK — fan-out)
                                       └────────► Anthropic Claude / OpenAI / VoyageAI (LLMs + embeddings)
                                       └────────► Vonage SMS, Bitly URL shortening
                                       └────────► Datadog APM (dd-trace)
```

- **Database**: PostgreSQL via Sequelize 6.29 + `pg`, accessed through `DATABASE_URL`.
- **Queue / cache**: Redis via `ioredis` (also as `cache-manager-ioredis` cache backend) — BullMQ 5.70 jobs with Bull-Board admin UI mounted at `http://localhost:3002/queues`, protected by `QUEUES_ADMIN_PASSWORD`.
- **Real-time**: Pusher 5.1.1-beta server SDK for coach/candidate chat fan-out.
- **AI**: `@anthropic-ai/sdk` 0.91.1, `openai` 4.98.0, `voyageai` 0.2.1 — used for matching, profile recommendations and prompt-cached chat.
- **PDF / images**: `pdf-lib` 1.17, `pdf2pic` 3.1.4, `puppeteer-core` 16.1.0, `sharp` 0.32.6 — CV rendering pipeline.
- **CRM**: Salesforce via `jsforce` 1.11 (OAuth client-credentials), syncing contacts, companies, campaigns and events.
- **Email**: Mailjet via `node-mailjet` 6.0.4 (transactional), `@mailchimp/mailchimp_marketing` (newsletter).

## Installing / scripts

```bash
corepack enable
pnpm install

pnpm run db:create
pnpm run db:migrate
pnpm run db:seed
pnpm run db:dump        # ./dump-db-schema.sh

# Local dev (watch mode)
pnpm run api:dev
pnpm run worker:dev

# Docker dev
pnpm run api:dev:docker
pnpm run worker:dev:docker
pnpm run all:dev:docker
pnpm run api:dev:docker:build

# Build & run prod
pnpm run build
pnpm run api:start
pnpm run worker:start

# Tests
pnpm run test:e2e            # local Jest e2e
pnpm run test:e2e:docker     # e2e against docker-compose.test.yml
pnpm run test:eslint
```

Docker:

- `docker-compose.yml` — API + Postgres + Redis.
- `docker-compose.worker.yml` (overlay) — adds the worker.
- `docker-compose.test.yml` — isolated test environment.
- `docker-entrypoint.sh`, `docker-entrypoint.test.sh`, `docker-entrypoint.worker.sh` — per-role entrypoints.

Heroku Procfile:

```
release:    pnpm db:migrate
web:        pnpm api:start
mainWorker: pnpm worker:start
```

## External libraries

- **Framework / ORM**: NestJS 9.4.1, Sequelize 6.29.0 + `pg`, `@nestjs/config`, `@nestjs/jwt`.
- **Auth**: Passport JWT + Local (v0.6.0 / v4.0.0), `express-basic-auth`.
- **Queue**: BullMQ 5.70.4, `@nestjs/bullmq`, Bull-Board.
- **Cache**: `ioredis`, `cache-manager`, `cache-manager-ioredis`.
- **AWS**: `@aws-sdk/client-s3`, `@aws-sdk/client-cloudfront`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner` (all v3.142.0).
- **Integrations**: `jsforce` 1.11 (Salesforce), `node-mailjet` 6.0.4, `@mailchimp/mailchimp_marketing`, `@anthropic-ai/sdk` 0.91.1, `openai` 4.98.0, `voyageai` 0.2.1, `@slack/bolt` 3.19, `pusher` 5.1.1-beta, `@vonage/server-sdk` 2.11.2, `bitly` 7.1.2.
- **PDF / image**: `pdf-lib` 1.17, `pdf2pic` 3.1.4, `puppeteer-core` 16.1.0, `sharp` 0.32.6.
- **Monitoring / hardening**: `dd-trace` 5.76, `@nestjs/throttler`, `class-validator`, `class-transformer`.
- **Utils**: `axios`, `node-fetch`, `lodash`, `moment` + `moment-timezone`, `uuid`, `validator`, `deep-diff`.
- **Test**: Jest, Supertest.

## Used technologies

- **Language**: TypeScript 4.3.5.
- **Runtime**: Node.js 20.x.
- **Framework**: NestJS 9.4.1 (`nest-cli.json`, plus `nest-cli.worker.json` for the worker).
- **DB / queue**: PostgreSQL + Redis (BullMQ).
- **Real-time**: Pusher.
- **Auth**: JWT + Passport strategies.
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`, `release.yml`).
- **Deployment**: Heroku (`web` + `mainWorker` dynos), Docker.

## Secrets (env vars)

`JWT_SECRET`,
`DATABASE_URL`, `REDIS_URL`,
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `VOYAGEAI_API_KEY`,
`MAILJET_PUB`, `MAILJET_SEC`, `MAILJET_NEWSLETTER_PUB`, `MAILJET_NEWSLETTER_SEC`, `MAILJET_NEWSLETTER_LIST_ID`, `MAILJET_FROM_EMAIL`, `MAILJET_FROM_NAME`, `MAILJET_SUPPORT_EMAIL`, `MAILJET_CONTACT_EMAIL`, `FIXIE_URL`,
`AWSS3_ID`, `AWSS3_SECRET`, `AWSS3_BUCKET_NAME`, `AWSS3_IMAGE_DIRECTORY`, `AWSS3_FILE_DIRECTORY`, `AWSS3_URL`, `CV_PDF_GENERATION_AWS_URL`, `CDN_ID`,
`ENABLE_SF`, `SALESFORCE_LOGIN_URL`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SF_INFOCO_CAMPAIGN_ID`, `SF_ORGANIZATION_ID`, `SF_WEBINAIRE_COACH_CAMPAIGN_ID`,
`PUSHER_APP_ID`, `PUSHER_API_KEY`, `PUSHER_API_SECRET`,
`SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, `QUEUES_ADMIN_PASSWORD`,
`DD_API_KEY`, `DD_ENV`, `DD_SERVICE`, `DD_TRACE_ENABLED`, `DD_LOGS_ENABLED`, `DD_TRACE_SAMPLE_RATE`, `DD_SITE`,
`FRONT_URL`, `HEROKU_APP_NAME`,
plus regional staff and WhatsApp variables: `STAFF_CONTACT_*_EMAIL_*`, `STAFF_CONTACT_*_SLACK_EMAIL_*`, `WHATSAPP_COACH_URL_*`, `WHATSAPP_CANDIDAT_URL_*` (per zone: Paris, Lyon, Lille, Rennes, Lorient, Sudouest, Hz).
