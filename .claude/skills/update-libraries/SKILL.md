---
name: update-libraries
description: Generate or update LIBRARIES.md at the root of the entourage-job-back repo to document all npm dependencies in package.json. Use when the user asks to "update libraries", "sync LIBRARIES.md", "update the library doc", or when package.json has changed.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Generate or update `LIBRARIES.md` at the root of the entourage-job-back repo to reflect the current state of `package.json`.

## Context

This is a **single-package NestJS 9 backend API** with one `package.json` at the root. The backend runs in two modes — HTTP API (`src/main.ts`) and background worker (`src/worker.ts`) — both sharing the same dependencies. Notable domain modules include: auth, companies, contacts, events, messaging, organizations, users, embeddings, profile-generation, read-documents (AI), elearning, gamification, public-cv, external-services, queues, redis, sessions.

## Steps

### 1. Read the current dependency list

Extract all `dependencies` and `devDependencies` from `entourage-job-back/package.json`. Separate them clearly — production deps run the API and worker, devDependencies are build/test/tooling only.

### 2. Detect changes against LIBRARIES.md (if it exists)

- New packages not yet documented → add them
- Packages no longer in package.json → remove them
- Version bumps → update version and release date fields
- No changes → state so and exit

### 3. For new or updated packages, understand their usage

Search the source files (`src/**/*.ts`) to understand how the package is actually used in this codebase before writing the entry. Pay attention to which domain modules import a given package.

### 4. Write each entry in this format

```
### `package-name`

| | |
|---|---|
| **Version** | `x.y.z` |
| **Release date** | Month YYYY (approximate) |
| **Changelog** | [CHANGELOG.md](url) |

One-sentence description of what the library does.

**Used in:** which domain modules or services use it and what for.

**Alternatives:** comma-separated alternatives.
```

### 5. Group entries under the following thematic sections

Use these groups (create new ones if a package doesn't fit):

**Production dependencies:**
- Framework — NestJS core packages (common, core, platform-express, config, jwt, passport, schedule, swagger, throttler, bullmq, sequelize, mapped-types, testing)
- Database — Sequelize, sequelize-typescript, sequelize-cli, pg, pg-hstore
- Queue & Background Jobs — BullMQ, Bull Board (api, express, nestjs)
- Cache — ioredis, cache-manager, cache-manager-ioredis
- Authentication — Passport, passport-local, passport-jwt, express-basic-auth
- AI & Embeddings — OpenAI SDK, VoyageAI
- CRM & Salesforce — jsforce
- Email — node-mailjet, @mailchimp/mailchimp_marketing
- SMS & Push Notifications — @vonage/server-sdk, pusher
- PDF Generation — pdf-lib, pdf2pic, puppeteer-core
- Cloud Storage — @aws-sdk/client-s3, @aws-sdk/lib-storage, @aws-sdk/s3-request-presigner, @aws-sdk/client-cloudfront
- HTTP & Networking — axios, node-fetch, qs
- Monitoring & Observability — dd-trace, @slack/bolt
- Validation & Transformation — class-validator, class-transformer, validator, check-password-strength, phone
- Utilities — Lodash, Moment, moment-timezone, UUID, Bitly, deep-diff, diff-match-patch, thenby, rxjs, reflect-metadata, sharp, dotenv, source-map-support, multer

**Dev dependencies *(dev)*:**
- Testing — Jest, ts-jest, supertest, @nestjs/testing, Faker
- Linting & Formatting — ESLint (typescript-eslint, import, prettier plugins), Prettier
- Build Tooling — TypeScript, ts-loader, ts-node, tsconfig-paths, rimraf, NestJS CLI, NestJS Schematics
- Developer Experience — Husky, Lint-staged, npm-run-all

### 6. Write the file

Produce `LIBRARIES.md` with this structure:

```
# Libraries

All npm packages declared in `package.json`, grouped by theme.

---

## [Group name]

### `package-name`
...

---
```

Mark dev-only packages with *(dev)* in their section header or inline.

Be precise about versions — use the exact version string from `package.json` (e.g. `^9.4.1`, `^5.70.4`).
