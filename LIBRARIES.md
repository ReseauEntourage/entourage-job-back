# Libraries

All npm packages declared in `package.json`, grouped by theme.

---

## Framework

### `@nestjs/common`

| | |
|---|---|
| **Version** | `^9.4.1` |
| **Release date** | April 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/nest/blob/master/CHANGELOG.md) |

Core NestJS package providing decorators, pipes, guards, interceptors, and utilities.

**Used in:** every module across the codebase — controllers, services, guards, interceptors.

**Alternatives:** Express (bare), Fastify, Hapi.

---

### `@nestjs/core`

| | |
|---|---|
| **Version** | `^9.4.1` |
| **Release date** | April 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/nest/blob/master/CHANGELOG.md) |

NestJS runtime kernel: bootstraps the application, wires the DI container, and manages module lifecycle.

**Used in:** `src/main.ts`, `src/worker.ts`.

**Alternatives:** —

---

### `@nestjs/platform-express`

| | |
|---|---|
| **Version** | `^9.4.1` |
| **Release date** | April 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/nest/blob/master/CHANGELOG.md) |

Express HTTP adapter for NestJS, enabling the framework to serve HTTP requests via Express.

**Used in:** `src/main.ts` as the default HTTP platform.

**Alternatives:** `@nestjs/platform-fastify`.

---

### `@nestjs/config`

| | |
|---|---|
| **Version** | `^2.3.2` |
| **Release date** | March 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/nest/blob/master/CHANGELOG.md) |

NestJS module for loading and accessing environment variables and `.env` files via `ConfigService`.

**Used in:** `src/app.module.ts` and most service constructors that need env vars.

**Alternatives:** `dotenv` directly, `convict`.

---

### `@nestjs/jwt`

| | |
|---|---|
| **Version** | `^10.0.3` |
| **Release date** | January 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/jwt/blob/master/CHANGELOG.md) |

NestJS wrapper for `jsonwebtoken` — signs and verifies JWT tokens.

**Used in:** `src/auth/` for issuing access tokens on login.

**Alternatives:** `jsonwebtoken` directly.

---

### `@nestjs/mapped-types`

| | |
|---|---|
| **Version** | `*` |
| **Release date** | — |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/mapped-types/blob/master/CHANGELOG.md) |

Utility types (`PartialType`, `PickType`, `OmitType`, `IntersectionType`) for NestJS DTOs.

**Used in:** DTO classes throughout the codebase to derive partial/extended types.

**Alternatives:** TypeScript utility types manually.

---

### `@nestjs/passport`

| | |
|---|---|
| **Version** | `^9.0.3` |
| **Release date** | January 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/passport/blob/master/CHANGELOG.md) |

NestJS Passport integration — adapts Passport.js strategies into NestJS guards.

**Used in:** `src/auth/` with local and JWT strategies.

**Alternatives:** Custom guards with `@nestjs/jwt` only.

---

### `@nestjs/schedule`

| | |
|---|---|
| **Version** | `^6.0.0` |
| **Release date** | 2024 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/schedule/blob/master/CHANGELOG.md) |

NestJS cron/interval scheduler backed by `node-cron`.

**Used in:** `src/cron/` for scheduled tasks (Salesforce sync, recommendation jobs, etc.).

**Alternatives:** BullMQ scheduled jobs, `node-cron` directly.

---

### `@nestjs/sequelize`

| | |
|---|---|
| **Version** | `^9.0.2` |
| **Release date** | January 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/sequelize/blob/master/CHANGELOG.md) |

NestJS Sequelize integration — provides `SequelizeModule.forRoot()` and `@InjectModel()`.

**Used in:** `src/app.module.ts` and all domain model modules.

**Alternatives:** TypeORM, Prisma, Drizzle.

---

### `@nestjs/swagger`

| | |
|---|---|
| **Version** | `^6.3.0` |
| **Release date** | March 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/swagger/blob/master/CHANGELOG.md) |

Auto-generates OpenAPI (Swagger) documentation from NestJS decorators and DTOs.

**Used in:** `src/main.ts` to expose `/api` Swagger UI.

**Alternatives:** Redoc, manual OpenAPI spec.

---

### `@nestjs/throttler`

| | |
|---|---|
| **Version** | `^4.0.0` |
| **Release date** | January 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/nestjs/throttler/blob/master/CHANGELOG.md) |

Rate-limiting guard for NestJS routes using in-memory or Redis storage.

**Used in:** `src/app.module.ts` applied globally to limit abusive requests.

**Alternatives:** `express-rate-limit`, custom Redis-based rate limiter.

---

### `reflect-metadata`

| | |
|---|---|
| **Version** | `^0.1.13` |
| **Release date** | 2016 |
| **Changelog** | [GitHub](https://github.com/rbuckton/reflect-metadata) |

Polyfill for the ES Metadata Reflection API, required by TypeScript decorators and NestJS DI.

**Used in:** imported once in `src/main.ts`; required globally by NestJS.

**Alternatives:** —

---

### `rxjs`

| | |
|---|---|
| **Version** | `^7.8.2` |
| **Release date** | March 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/ReactiveX/rxjs/blob/master/CHANGELOG.md) |

Reactive Extensions for JavaScript — observable streams used by NestJS internals and custom interceptors.

**Used in:** `src/api-keys/guards/api-key.guard.ts`, `src/common/interceptors/timeout.interceptor.ts`, NestJS framework internals.

**Alternatives:** —

---

## Database

### `sequelize`

| | |
|---|---|
| **Version** | `^6.29.0` |
| **Release date** | January 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/sequelize/sequelize/blob/main/CHANGELOG.md) |

Promise-based ORM for Node.js supporting PostgreSQL, MySQL, SQLite and more.

**Used in:** all domain models for querying and mutating data in PostgreSQL.

**Alternatives:** TypeORM, Prisma, Drizzle, Knex.

---

### `sequelize-typescript`

| | |
|---|---|
| **Version** | `^2.1.6` |
| **Release date** | 2022 |
| **Changelog** | [GitHub releases](https://github.com/sequelize/sequelize-typescript/releases) |

TypeScript decorators (`@Table`, `@Column`, `@Model`, etc.) for Sequelize models.

**Used in:** every model file under `src/*/models/`.

**Alternatives:** —

---

### `sequelize-cli`

| | |
|---|---|
| **Version** | `^6.4.1` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/sequelize/cli) |

CLI for running migrations and seeders (`yarn db:migrate`, `yarn db:seed`).

**Used in:** `package.json` scripts (`db:migrate`, `db:seed`), migration files under `src/db/migrations/`.

**Alternatives:** Flyway, Liquibase.

---

### `pg`

| | |
|---|---|
| **Version** | `^8.8.0` |
| **Release date** | October 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/brianc/node-postgres/blob/master/CHANGELOG.md) |

PostgreSQL client for Node.js — the underlying driver used by Sequelize.

**Used in:** implicitly via Sequelize for all database connections.

**Alternatives:** `@electric-sql/pglite` (embedded), `postgres` (modern alternative).

---

### `pg-hstore`

| | |
|---|---|
| **Version** | `^2.3.4` |
| **Release date** | 2018 |
| **Changelog** | [GitHub](https://github.com/scarney81/pg-hstore) |

Serializes/deserializes PostgreSQL `hstore` data type, required by `pg` when using hstore columns.

**Used in:** implicitly required by Sequelize/pg when hstore columns are present.

**Alternatives:** —

---

## Queue & Background Jobs

### `bullmq`

| | |
|---|---|
| **Version** | `^5.70.4` |
| **Release date** | March 2025 |
| **Changelog** | [CHANGELOG.md](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/changelog.md) |

Redis-backed job queue with support for delayed jobs, priorities, retries, and workers.

**Used in:** `src/queues/` — producers schedule jobs (email, Salesforce sync, embeddings, profile generation, CV PDF), consumers process them in the background worker.

**Alternatives:** `bull` (v3, legacy), `bee-queue`, `pg-boss`.

---

### `@nestjs/bullmq`

| | |
|---|---|
| **Version** | `^11.0.4` |
| **Release date** | 2024 |
| **Changelog** | [GitHub releases](https://github.com/nestjs/bullmq/releases) |

NestJS integration for BullMQ providing `BullModule`, `@Processor`, `@InjectQueue` decorators.

**Used in:** `src/queues/` and `src/app.module.ts`.

**Alternatives:** —

---

### `@bull-board/api`

| | |
|---|---|
| **Version** | `^6.13.1` |
| **Release date** | 2024 |
| **Changelog** | [GitHub releases](https://github.com/felixmosh/bull-board/releases) |

Framework-agnostic API layer for the Bull Board queue monitoring UI.

**Used in:** `src/queues/producers/queues-board.module.ts` to expose queue inspection.

**Alternatives:** —

---

### `@bull-board/express`

| | |
|---|---|
| **Version** | `^6.13.1` |
| **Release date** | 2024 |
| **Changelog** | [GitHub releases](https://github.com/felixmosh/bull-board/releases) |

Express adapter for Bull Board — serves the UI as an Express router.

**Used in:** `src/queues/producers/queues-board.module.ts`.

**Alternatives:** `@bull-board/fastify`, `@bull-board/hapi`.

---

### `@bull-board/nestjs`

| | |
|---|---|
| **Version** | `^6.13.1` |
| **Release date** | 2024 |
| **Changelog** | [GitHub releases](https://github.com/felixmosh/bull-board/releases) |

NestJS adapter to mount Bull Board via `BullBoardModule`.

**Used in:** `src/queues/producers/queues-board.module.ts`.

**Alternatives:** —

---

## Cache

### `ioredis`

| | |
|---|---|
| **Version** | `^5.6.1` |
| **Release date** | 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/redis/ioredis/blob/main/CHANGELOG.md) |

Robust, full-featured Redis client for Node.js with clustering, pipelining, and Lua scripting support.

**Used in:** `src/redis/`, `src/app.module.ts` (BullMQ connection), `src/sessions/`.

**Alternatives:** `redis` (official client), `node-redis`.

---

### `cache-manager`

| | |
|---|---|
| **Version** | `^4.1.0` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/node-cache-manager/node-cache-manager) |

Flexible multi-store cache module for Node.js, used as the NestJS cache abstraction layer.

**Used in:** `src/app.module.ts` via `CacheModule.register()`.

**Alternatives:** Direct `ioredis` caching.

---

### `cache-manager-ioredis`

| | |
|---|---|
| **Version** | `^2.1.0` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/dabroek/node-cache-manager-ioredis) |

Redis store adapter for `cache-manager` backed by `ioredis`.

**Used in:** `src/app.module.ts` as the backing store for `CacheModule`.

**Alternatives:** `@tirke/node-cache-manager-ioredis` (maintained fork).

---

## Authentication

### `passport`

| | |
|---|---|
| **Version** | `^0.6.0` |
| **Release date** | 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/jaredhanson/passport/blob/master/CHANGELOG.md) |

Authentication middleware for Node.js with a strategy-based plugin architecture.

**Used in:** `src/auth/` as the underlying auth engine wired through `@nestjs/passport`.

**Alternatives:** custom guards, `oslo` (modern alternative).

---

### `passport-local`

| | |
|---|---|
| **Version** | `^1.0.0` |
| **Release date** | 2013 |
| **Changelog** | [GitHub](https://github.com/jaredhanson/passport-local) |

Passport strategy for username/password authentication.

**Used in:** `src/auth/strategies/local.strategy.ts` for the login endpoint.

**Alternatives:** custom credential validator.

---

### `passport-jwt`

| | |
|---|---|
| **Version** | `^4.0.0` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/mikenicholson/passport-jwt) |

Passport strategy that validates JWT Bearer tokens from the `Authorization` header.

**Used in:** `src/auth/strategies/jwt.strategy.ts` to protect authenticated routes.

**Alternatives:** `@nestjs/jwt` guard without Passport.

---

### `express-basic-auth`

| | |
|---|---|
| **Version** | `^1.2.1` |
| **Release date** | 2020 |
| **Changelog** | [GitHub](https://github.com/LionC/express-basic-auth) |

Simple HTTP Basic Auth middleware for Express.

**Used in:** `src/queues/producers/queues-board.module.ts` to protect the Bull Board UI.

**Alternatives:** custom middleware.

---

## AI & Embeddings

### `openai`

| | |
|---|---|
| **Version** | `^4.98.0` |
| **Release date** | April 2025 |
| **Changelog** | [CHANGELOG.md](https://github.com/openai/openai-node/blob/master/CHANGELOG.md) |

Official OpenAI Node.js SDK for chat completions and vision APIs.

**Used in:** `src/external-services/openai/` for structured CV extraction from PDF images (vision), `src/profile-generation/` for AI profile text generation, `src/external-cvs/` for parsing external CV documents.

**Alternatives:** `@anthropic-ai/sdk`, `@google-cloud/vertexai`.

---

### `voyageai`

| | |
|---|---|
| **Version** | `^0.2.1` |
| **Release date** | 2024 |
| **Changelog** | [GitHub](https://github.com/voyage-ai/voyageai-node) |

Voyage AI client for generating high-quality text embeddings.

**Used in:** `src/external-services/voyageai/` and `src/queues/consumers/embedding-queue.processor.ts` to produce semantic embeddings stored in `UserProfileEmbeddings`.

**Alternatives:** OpenAI embeddings API, Cohere embed.

---

## CRM & Salesforce

### `jsforce`

| | |
|---|---|
| **Version** | `^1.11.0` |
| **Release date** | 2021 |
| **Changelog** | [CHANGELOG.md](https://github.com/jsforce/jsforce/blob/master/CHANGELOG.md) |

Salesforce API client for Node.js — SOQL queries, REST/Bulk API, OAuth support.

**Used in:** `src/external-services/salesforce/` (`salesforce.service.ts`, `salesforce.utils.ts`) and `src/contacts/`, `src/events/` to sync data with Salesforce CRM.

**Alternatives:** `@jsforce/jsforce-node` (v2), raw Salesforce REST API calls.

---

## Email

### `node-mailjet`

| | |
|---|---|
| **Version** | `^6.0.4` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/mailjet/mailjet-apiv3-nodejs) |

Official Mailjet API v3 client for sending transactional emails via templates.

**Used in:** `src/external-services/mailjet/` — all transactional emails (welcome, password reset, notifications, invitations) are dispatched through Mailjet templates.

**Alternatives:** SendGrid, Postmark, AWS SES.

---

### `@mailchimp/mailchimp_marketing`

| | |
|---|---|
| **Version** | `^3.0.78` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/mailchimp/mailchimp-marketing-node) |

Official Mailchimp Marketing API client for managing contacts and lists.

**Used in:** declared as a production dependency; handles newsletter subscription management (contacts/contacts opt-in flows).

**Alternatives:** Brevo (Sendinblue), Klaviyo.

---

## SMS & Push Notifications

### `@vonage/server-sdk`

| | |
|---|---|
| **Version** | `^2.11.2` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/Vonage/vonage-node-sdk) |

Vonage (Nexmo) SDK for sending SMS messages and other communication APIs.

**Used in:** declared as a production dependency for SMS notifications (phone verification or alert delivery).

**Alternatives:** Twilio, AWS SNS.

---

### `pusher`

| | |
|---|---|
| **Version** | `^5.1.1-beta` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/pusher/pusher-http-node) |

Pusher Channels server SDK for broadcasting real-time events to connected clients.

**Used in:** `src/external-services/pusher/` and `src/queues/consumers/profile-generator.processor.ts` — pushes real-time notifications to the front-end when profile generation completes.

**Alternatives:** Socket.io, Ably, AWS IoT.

---

## PDF Generation

### `pdf-lib`

| | |
|---|---|
| **Version** | `^1.17.1` |
| **Release date** | 2021 |
| **Changelog** | [CHANGELOG.md](https://github.com/Hopding/pdf-lib/blob/master/CHANGELOG.md) |

Pure JavaScript PDF creation and modification library — no native dependencies.

**Used in:** CV generation pipeline (public-cv / profile generation) for building PDF documents.

**Alternatives:** `pdfkit`, `puppeteer` (headless Chrome rendering).

---

### `pdf2pic`

| | |
|---|---|
| **Version** | `^3.1.4` |
| **Release date** | 2023 |
| **Changelog** | [GitHub](https://github.com/yakovmeister/pdf2image) |

Converts PDF pages to images (PNG/JPEG) using `pdftocairo` / GraphicsMagick.

**Used in:** `src/external-services/openai/openai.service.ts` (comment references `ToBase64Response`) and `src/queues/consumers/profile-generator.processor.ts` for converting uploaded CV PDFs to images before passing them to the OpenAI vision API.

**Alternatives:** `pdfjs-dist`, `pdf-poppler`, `pdf.js`.

---

### `puppeteer-core`

| | |
|---|---|
| **Version** | `^16.1.0` |
| **Release date** | September 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/puppeteer/puppeteer/blob/main/CHANGELOG.md) |

Headless Chromium automation library (without bundled Chrome) for HTML-to-PDF rendering.

**Used in:** CV generation (`src/public-cv/` or profile-generation pipeline) for rendering CV templates to PDF via headless Chrome.

**Alternatives:** `playwright`, `wkhtmltopdf`, `pdf-lib`.

---

## Cloud Storage

### `@aws-sdk/client-s3`

| | |
|---|---|
| **Version** | `^3.142.0` |
| **Release date** | August 2022 |
| **Changelog** | [GitHub](https://github.com/aws/aws-sdk-js-v3) |

AWS SDK v3 S3 client — uploads, downloads, and manages objects in S3 buckets.

**Used in:** `src/external-services/aws/s3.service.ts` for storing user CVs, profile pictures, and media files.

**Alternatives:** MinIO client, `@google-cloud/storage`.

---

### `@aws-sdk/lib-storage`

| | |
|---|---|
| **Version** | `^3.180.0` |
| **Release date** | October 2022 |
| **Changelog** | [GitHub](https://github.com/aws/aws-sdk-js-v3) |

S3 multipart upload utility (`Upload` class) for streaming large files to S3 reliably.

**Used in:** `src/external-services/aws/s3.service.ts` via the `Upload` class.

**Alternatives:** `@aws-sdk/client-s3` `PutObjectCommand` for small files.

---

### `@aws-sdk/s3-request-presigner`

| | |
|---|---|
| **Version** | `^3.142.0` |
| **Release date** | August 2022 |
| **Changelog** | [GitHub](https://github.com/aws/aws-sdk-js-v3) |

Generates pre-signed S3 URLs for temporary, authenticated access to private objects.

**Used in:** `src/external-services/aws/s3.service.ts` via `getSignedUrl`.

**Alternatives:** Custom signed URL generation.

---

### `@aws-sdk/client-cloudfront`

| | |
|---|---|
| **Version** | `^3.142.0` |
| **Release date** | August 2022 |
| **Changelog** | [GitHub](https://github.com/aws/aws-sdk-js-v3) |

AWS SDK v3 CloudFront client — creates cache invalidations when S3 objects are updated.

**Used in:** `src/external-services/aws/cloud-front.service.ts` to bust CloudFront CDN cache after file uploads.

**Alternatives:** Manual cache invalidation via REST API.

---

## HTTP & Networking

### `axios`

| | |
|---|---|
| **Version** | `^1.9.0` |
| **Release date** | April 2025 |
| **Changelog** | [CHANGELOG.md](https://github.com/axios/axios/blob/master/CHANGELOG.md) |

Promise-based HTTP client for Node.js and browsers.

**Used in:** `src/queues/consumers/profile-generator.processor.ts` (downloads PDF from S3), `src/profile-generation/profile-generation.controller.ts`.

**Alternatives:** `node-fetch`, `undici`, native `fetch` (Node 18+).

---

### `node-fetch`

| | |
|---|---|
| **Version** | `^2.6.7` |
| **Release date** | 2021 |
| **Changelog** | [CHANGELOG.md](https://github.com/node-fetch/node-fetch/blob/main/CHANGELOG.md) |

Lightweight Fetch API implementation for Node.js (v2 — CommonJS compatible).

**Used in:** declared as a production dependency; used in lower-level HTTP calls or transitively by other packages.

**Alternatives:** `axios`, native `fetch` (Node 18+).

---

### `qs`

| | |
|---|---|
| **Version** | `^6.11.0` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/ljharb/qs) |

Query string parser and stringifier with support for nested objects and arrays.

**Used in:** serialising complex query parameters for HTTP requests (used transitively by `axios`/`jsforce` or directly in API calls).

**Alternatives:** URLSearchParams (native), `querystring` (built-in, deprecated).

---

## Monitoring & Observability

### `dd-trace`

| | |
|---|---|
| **Version** | `^5.76.0` |
| **Release date** | April 2025 |
| **Changelog** | [CHANGELOG.md](https://github.com/DataDog/dd-trace-js/blob/master/CHANGELOG.md) |

Datadog APM tracer for Node.js — auto-instruments HTTP, database, Redis, and queue calls.

**Used in:** `src/tracer.ts` (initialized before app bootstrap), `src/logging.interceptor.ts`.

**Alternatives:** OpenTelemetry, New Relic agent.

---

### `@slack/bolt`

| | |
|---|---|
| **Version** | `^3.19.0` |
| **Release date** | 2024 |
| **Changelog** | [CHANGELOG.md](https://github.com/slackapi/bolt-js/blob/main/CHANGELOG.md) |

Slack Bolt framework for building Slack apps — handles event subscriptions, slash commands, and messaging.

**Used in:** `src/external-services/slack/` for posting internal alerts/notifications to Slack channels. Also used in `src/companies/` to notify the team of company-related events.

**Alternatives:** `@slack/web-api` (lower-level client).

---

## Validation & Transformation

### `class-validator`

| | |
|---|---|
| **Version** | `^0.14.0` |
| **Release date** | November 2022 |
| **Changelog** | [GitHub](https://github.com/typestack/class-validator) |

Decorator-based validation for TypeScript classes, integrated with NestJS `ValidationPipe`.

**Used in:** every DTO class across the codebase for request body validation.

**Alternatives:** `zod`, `joi`, `yup`.

---

### `class-transformer`

| | |
|---|---|
| **Version** | `^0.5.1` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/typestack/class-transformer) |

Transforms plain objects to/from class instances, works alongside `class-validator`.

**Used in:** NestJS `ValidationPipe` and `ClassSerializerInterceptor` across all request/response handling.

**Alternatives:** —

---

### `validator`

| | |
|---|---|
| **Version** | `^13.7.0` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/validatorjs/validator.js) |

String validation and sanitization library (email, URL, UUID, etc.).

**Used in:** `class-validator` internally; also available for direct string validation in service logic.

**Alternatives:** Built-in `class-validator` decorators.

---

### `check-password-strength`

| | |
|---|---|
| **Version** | `^2.0.7` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/deanilvincent/check-password-strength) |

Evaluates password strength and returns a score with feedback.

**Used in:** `src/auth/auth.controller.ts` and `src/users/users.controller.ts` to enforce password policy on registration/password change.

**Alternatives:** `zxcvbn`.

---

### `phone`

| | |
|---|---|
| **Version** | `^3.1.23` |
| **Release date** | 2023 |
| **Changelog** | [GitHub](https://github.com/AfterShip/phone) |

Validates and normalises international phone numbers (E.164 format).

**Used in:** `src/utils/misc/isValidPhone.ts` for validating user phone numbers before storage.

**Alternatives:** `libphonenumber-js`, Google's `libphonenumber`.

---

## Utilities

### `lodash`

| | |
|---|---|
| **Version** | `^4.17.21` |
| **Release date** | 2021 |
| **Changelog** | [CHANGELOG.md](https://github.com/lodash/lodash/wiki/Changelog) |

General-purpose utility library for arrays, objects, strings, and functions.

**Used in:** `src/mails/mails.service.ts`, `src/external-services/mailjet/mailjet.utils.ts`, `src/external-services/salesforce/salesforce.utils.ts`, `src/revisions/revisions.utils.ts`, `src/users/guards/self.guard.ts`, `src/user-profiles/`.

**Alternatives:** Native ES2022+ methods, `remeda` (typed alternative).

---

### `moment`

| | |
|---|---|
| **Version** | `^2.29.4` |
| **Release date** | 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/moment/moment/blob/develop/CHANGELOG.md) |

Date parsing, validation, and formatting library (legacy but widely used).

**Used in:** `src/embeddings/embedding.builder.ts`, `src/events/events.utils.ts`, `src/user-profiles/recommendations/user-profile-recommendations-ai.service.ts`.

**Alternatives:** `date-fns`, `dayjs`, native `Temporal` API.

---

### `moment-timezone`

| | |
|---|---|
| **Version** | `^0.5.43` |
| **Release date** | 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/moment/moment-timezone/blob/develop/CHANGELOG.md) |

Timezone-aware date handling extending `moment`.

**Used in:** `src/external-services/salesforce/salesforce.service.ts` for converting timestamps when syncing with Salesforce.

**Alternatives:** `date-fns-tz`, `luxon`.

---

### `uuid`

| | |
|---|---|
| **Version** | `^8.3.2` |
| **Release date** | 2021 |
| **Changelog** | [CHANGELOG.md](https://github.com/uuidjs/uuid/blob/main/CHANGELOG.md) |

RFC 4122 UUID generation (`v4`) and validation.

**Used in:** `src/medias/medias.service.ts` (generate IDs), `src/companies/companies.controller.ts`, `src/users/users.controller.ts`, `src/user-profiles/user-profiles.controller.ts` (validate UUID path params).

**Alternatives:** `crypto.randomUUID()` (Node 14.17+ native).

---

### `bitly`

| | |
|---|---|
| **Version** | `^7.1.2` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/tanepiper/node-bitly) |

Bitly API client for shortening URLs.

**Used in:** declared as a production dependency; shortens shareable URLs (e.g. public CV links).

**Alternatives:** TinyURL API, custom short-link service.

---

### `deep-diff`

| | |
|---|---|
| **Version** | `^1.0.2` |
| **Release date** | 2019 |
| **Changelog** | [GitHub](https://github.com/flitbit/diff) |

Computes structural differences between two JavaScript objects.

**Used in:** `src/revisions/revisions.utils.ts` to record entity change history in the `Revisions` audit trail.

**Alternatives:** `jsondiffpatch`, `microdiff`.

---

### `diff-match-patch`

| | |
|---|---|
| **Version** | `^1.0.5` |
| **Release date** | 2019 |
| **Changelog** | [GitHub](https://github.com/google/diff-match-patch) |

Google's diff/match/patch algorithm for text strings.

**Used in:** `src/revisions/revisions.utils.ts` alongside `deep-diff` to produce human-readable text diffs for the revision history.

**Alternatives:** `diff` (npm), `jsdiff`.

---

### `thenby`

| | |
|---|---|
| **Version** | `^1.3.4` |
| **Release date** | 2019 |
| **Changelog** | [GitHub](https://github.com/Teun/thenby) |

Chainable multi-column sort for arrays of objects (`firstBy(...).thenBy(...)`).

**Used in:** declared as a production dependency; used for multi-key sorting of results (e.g. user lists, recommendations).

**Alternatives:** `lodash.orderby`, custom comparators.

---

### `sharp`

| | |
|---|---|
| **Version** | `^0.32.6` |
| **Release date** | 2023 |
| **Changelog** | [CHANGELOG.md](https://github.com/lovell/sharp/blob/main/CHANGELOG.md) |

High-performance Node.js image processing — resize, compress, and convert images.

**Used in:** `src/user-profiles/user-profiles.service.ts` to process and resize user profile pictures before uploading to S3.

**Alternatives:** `jimp`, `imagemagick`, `canvas`.

---

### `multer`

| | |
|---|---|
| **Version** | `1.4.5-lts.2` |
| **Release date** | 2022 (LTS patch) |
| **Changelog** | [GitHub](https://github.com/expressjs/multer) |

Express middleware for handling `multipart/form-data` file uploads.

**Used in:** `src/companies/companies.controller.ts` (logo upload), `src/external-cvs/external-cvs.controller.ts` (CV PDF upload), `src/messaging/messaging.controller.ts` (message media upload), via `Express.Multer.File` type throughout.

**Alternatives:** `busboy`, `formidable`.

---

### `dotenv`

| | |
|---|---|
| **Version** | `^16.0.1` |
| **Release date** | 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md) |

Loads environment variables from a `.env` file into `process.env`.

**Used in:** bootstrapping — loaded before NestJS `ConfigModule` in `src/main.ts` / migration scripts.

**Alternatives:** `@nestjs/config` (wraps dotenv).

---

### `rimraf`

| | |
|---|---|
| **Version** | `^3.0.2` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/isaacs/rimraf) |

Cross-platform `rm -rf` for Node.js.

**Used in:** `package.json` `prebuild` script (`rimraf dist`) to clean the build output before compiling.

**Alternatives:** `fs.rmSync` (Node 14.14+ native), `del`.

---

## Testing *(dev)*

### `jest`

| | |
|---|---|
| **Version** | `^27.2.5` |
| **Release date** | September 2021 |
| **Changelog** | [CHANGELOG.md](https://github.com/facebook/jest/blob/main/CHANGELOG.md) |

JavaScript testing framework with built-in assertions, mocking, and coverage.

**Used in:** `tests/` — all E2E tests run with `yarn test:e2e`.

**Alternatives:** Vitest, Mocha.

---

### `ts-jest`

| | |
|---|---|
| **Version** | `^27.0.3` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/kulshekhar/ts-jest) |

Jest transformer that runs TypeScript test files directly without a separate compile step.

**Used in:** `tests/jest-e2e.json` Jest configuration.

**Alternatives:** `babel-jest` with TypeScript preset, `@swc/jest`.

---

### `supertest`

| | |
|---|---|
| **Version** | `^6.1.3` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/ladjs/supertest) |

HTTP assertion library for testing Express/NestJS endpoints without starting a real server.

**Used in:** all E2E tests in `tests/` for making HTTP requests against the in-process NestJS app.

**Alternatives:** `axios` with a running server, `undici`.

---

### `@nestjs/testing`

| | |
|---|---|
| **Version** | `^9.4.1` |
| **Release date** | April 2023 |
| **Changelog** | [GitHub](https://github.com/nestjs/nest/blob/master/CHANGELOG.md) |

NestJS testing utilities (`Test.createTestingModule()`) for bootstrapping isolated module contexts in tests.

**Used in:** E2E test setup files in `tests/`.

**Alternatives:** —

---

### `@faker-js/faker`

| | |
|---|---|
| **Version** | `^7.0.0` |
| **Release date** | 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/faker-js/faker/blob/next/CHANGELOG.md) |

Generates realistic fake data (names, emails, addresses, etc.) for tests and seeds.

**Used in:** E2E test factories and database seed helpers in `tests/`.

**Alternatives:** `chance`, `casual`.

---

## Linting & Formatting *(dev)*

### `eslint`

| | |
|---|---|
| **Version** | `^8.0.1` |
| **Release date** | 2021 |
| **Changelog** | [CHANGELOG.md](https://github.com/eslint/eslint/blob/main/CHANGELOG.md) |

Pluggable JavaScript/TypeScript linter.

**Used in:** `yarn test:eslint` — enforces code style and quality rules across `src/` and `tests/`.

**Alternatives:** Biome, deno lint.

---

### `@typescript-eslint/eslint-plugin`

| | |
|---|---|
| **Version** | `^5.0.0` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/typescript-eslint/typescript-eslint) |

ESLint rules specific to TypeScript (type-aware linting).

**Used in:** `.eslintrc.js` for TypeScript-specific lint rules.

**Alternatives:** —

---

### `@typescript-eslint/parser`

| | |
|---|---|
| **Version** | `^5.0.0` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/typescript-eslint/typescript-eslint) |

ESLint parser that understands TypeScript syntax.

**Used in:** `.eslintrc.js` as the parser for TypeScript files.

**Alternatives:** `@babel/eslint-parser`.

---

### `eslint-config-prettier`

| | |
|---|---|
| **Version** | `^8.5.0` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/prettier/eslint-config-prettier) |

Disables ESLint rules that conflict with Prettier formatting.

**Used in:** `.eslintrc.js` — applied last in the config chain.

**Alternatives:** —

---

### `eslint-plugin-import`

| | |
|---|---|
| **Version** | `^2.25.4` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/import-js/eslint-plugin-import) |

Lints ES module import/export syntax, missing modules, and import order.

**Used in:** `.eslintrc.js`.

**Alternatives:** `eslint-plugin-n`.

---

### `eslint-import-resolver-typescript`

| | |
|---|---|
| **Version** | `^2.5.0` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/import-js/eslint-import-resolver-typescript) |

Teaches `eslint-plugin-import` to resolve TypeScript path aliases and `.ts` files.

**Used in:** `.eslintrc.js` alongside `eslint-plugin-import`.

**Alternatives:** —

---

### `eslint-plugin-prettier`

| | |
|---|---|
| **Version** | `^4.0.0` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/prettier/eslint-plugin-prettier) |

Runs Prettier as an ESLint rule and reports formatting differences as lint errors.

**Used in:** `.eslintrc.js`.

**Alternatives:** Run Prettier separately.

---

### `eslint-plugin-typescript-sort-keys`

| | |
|---|---|
| **Version** | `^2.1.0` |
| **Release date** | 2022 |
| **Changelog** | [GitHub](https://github.com/infctr/eslint-plugin-typescript-sort-keys) |

Enforces alphabetical ordering of TypeScript interface/type keys.

**Used in:** `.eslintrc.js` to keep interface/type definitions consistently sorted.

**Alternatives:** —

---

### `prettier`

| | |
|---|---|
| **Version** | `^2.6.0` |
| **Release date** | 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/prettier/prettier/blob/main/CHANGELOG.md) |

Opinionated code formatter for TypeScript, JSON, and more.

**Used in:** `yarn format` to auto-format `src/**/*.ts` and `tests/**/*.ts`.

**Alternatives:** Biome, dprint.

---

## Build Tooling *(dev)*

### `typescript`

| | |
|---|---|
| **Version** | `^4.3.5` |
| **Release date** | 2021 |
| **Changelog** | [CHANGELOG.md](https://github.com/microsoft/TypeScript/wiki/Breaking-Changes) |

TypeScript compiler for static type checking and transpilation.

**Used in:** `yarn test:ts-check` (`tsc --noEmit`) and `yarn build` via NestJS CLI.

**Alternatives:** —

---

### `@nestjs/cli`

| | |
|---|---|
| **Version** | `^11.0.12` |
| **Release date** | 2024 |
| **Changelog** | [GitHub](https://github.com/nestjs/nest-cli) |

NestJS CLI for building, watching, and generating code (`nest build`, `nest start`).

**Used in:** all `pnpm run api:*` and `pnpm run worker:*` scripts.

**Alternatives:** `tsc` directly, `ts-node`.

---

### `@nestjs/schematics`

| | |
|---|---|
| **Version** | `^9.2.0` |
| **Release date** | 2023 |
| **Changelog** | [GitHub](https://github.com/nestjs/schematics) |

Angular-style code generation schematics used by the NestJS CLI.

**Used in:** `nest generate` commands (implicit dependency of `@nestjs/cli`).

**Alternatives:** —

---

### `ts-node`

| | |
|---|---|
| **Version** | `^10.0.0` |
| **Release date** | 2021 |
| **Changelog** | [CHANGELOG.md](https://github.com/TypeStrong/ts-node/blob/main/CHANGELOG.md) |

TypeScript execution engine for Node.js — runs `.ts` files directly without pre-compilation.

**Used in:** Sequelize CLI configuration (`sequelize-cli` uses `ts-node` to process migration files), and `nest start --watch`.

**Alternatives:** `tsx`, `esbuild-register`.

---

### `ts-loader`

| | |
|---|---|
| **Version** | `^9.2.3` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/TypeStrong/ts-loader) |

Webpack loader for TypeScript files (used by NestJS CLI's webpack build mode).

**Used in:** NestJS CLI build pipeline.

**Alternatives:** `babel-loader` with TypeScript preset, `esbuild-loader`.

---

### `tsconfig-paths`

| | |
|---|---|
| **Version** | `^3.10.1` |
| **Release date** | 2021 |
| **Changelog** | [GitHub](https://github.com/dividab/tsconfig-paths) |

Resolves TypeScript path aliases (e.g. `src/...`) at runtime for `ts-node`.

**Used in:** `ts-node` and Jest configurations to resolve `src/` imports.

**Alternatives:** `module-alias`.

---

### `source-map-support`

| | |
|---|---|
| **Version** | `^0.5.20` |
| **Release date** | 2020 |
| **Changelog** | [GitHub](https://github.com/evanw/node-source-map-support) |

Maps compiled JavaScript stack traces back to TypeScript source lines.

**Used in:** production entrypoints and test bootstrap for readable stack traces.

**Alternatives:** Node.js `--enable-source-maps` flag (Node 12.12+).

---

## Developer Experience *(dev)*

### `husky`

| | |
|---|---|
| **Version** | `^8.0.1` |
| **Release date** | 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/typicode/husky/blob/main/CHANGELOG.md) |

Git hooks manager — runs scripts on `pre-commit`, `commit-msg`, etc.

**Used in:** `package.json` `prepare` script installs hooks; `.husky/pre-commit` runs `lint-staged`.

**Alternatives:** `lefthook`, `pre-commit` (Python).

---

### `lint-staged`

| | |
|---|---|
| **Version** | `^13.0.3` |
| **Release date** | 2022 |
| **Changelog** | [CHANGELOG.md](https://github.com/okonet/lint-staged/blob/master/CHANGELOG.md) |

Runs linters and formatters only on staged Git files for fast pre-commit checks.

**Used in:** `.husky/pre-commit` — runs ESLint and Prettier on changed files before each commit.

**Alternatives:** `nano-staged`.

---

### `npm-run-all`

| | |
|---|---|
| **Version** | `^4.1.5` |
| **Release date** | 2019 |
| **Changelog** | [GitHub](https://github.com/mysticatea/npm-run-all) |

Runs multiple npm scripts sequentially (`run-s`) or in parallel (`run-p`).

**Used in:** `package.json` `test` script — `run-s test:*` chains `test:ts-check`, `test:eslint`, `test:e2e` in sequence.

**Alternatives:** `concurrently`, `&&` chaining.

---
