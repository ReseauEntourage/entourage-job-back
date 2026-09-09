# entourage-job-back — Claude Code Guide

## Project overview

NestJS + Sequelize + PostgreSQL + pgvector REST API for the Entourage Pro platform — a network connecting job seekers, coaches, and companies.

**Related repos:**

- `entourage-job-front` — Next.js frontend (always update in parallel when touching API contracts)
- `entourage-landing-pages`, `entourage-tasks`, `sql-tools` — secondary repos

## Code conventions

- **Comments and JSDoc must be written in English**, regardless of the conversation or PR language.

## Architecture notes

### Embeddings & recommendations (`UserProfileRecommendationsService`)

**Model:** VoyageAI `voyage-4-lite` — 1024 dimensions, stored in `UserProfileEmbeddings` (pgvector).  
**Embedding types:** `profile` (v3.0) and `needs` (v2.0).

`findBySimilarity` uses an HNSW ANN index (`embedding <=>`). Final score formula:

```
profile(40%) + needs(20%) + activity(30%) + locationCompatibility(10%)
```

Key parameters:

| Use case                           | `annPoolSize` | `poolSize` | `filterByAvailability` |
| ---------------------------------- | ------------- | ---------- | ---------------------- |
| Recommendations                    | 200           | 200        | `true`                 |
| Network directory (relevance sort) | 500           | 500        | `isAvailable === true` |

For the relevance sort, the flow is:

1. `findBySimilarity(annPoolSize=500, poolSize=500)` → ranked IDs
2. Intersect with Sequelize filters (availability, location, etc.)
3. Slice offset/limit
4. Fetch full profiles ordered by `ARRAY_POSITION`

### Circular dependency — `UserProfilesModule`

`UserProfilesService` and `UserProfileRecommendationsService` inject each other. Always use `forwardRef` for both sides:

```typescript
// In UserProfilesService
@Inject(forwardRef(() => UserProfileRecommendationsService))

// In UserProfileRecommendationsService
@Inject(forwardRef(() => UserProfilesService))
```

This was added as part of EN-9019. Do not remove the `forwardRef` wrappers.

### Network Directory sort (EN-9019)

`user-profiles.controller.ts` reads `@Query('sort')` and branches to `findAllByRelevance` when `sort === 'RELEVANCE'`. The default path is `LAST_CONNECTION` (standard Sequelize query, no embeddings).

## Running e2e tests — never against the dev database

There are two separate Postgres containers: `db` (local dev DB, real/manually-created
data) and `db-test` (disposable, used only by e2e tests). They are **not** switched by
`NODE_ENV` alone — `DATABASE_URL`/`DB_HOST` are baked into each container's own env file
(`.env` for `api`, `.env.test` for `api-test`).

Running `docker exec -e NODE_ENV=dev-test api ...` does **not** redirect the connection:
the `api` container's `DATABASE_URL` still points at `db`, so any e2e test executed this
way — including `DatabaseHelper.resetTestDB()` — truncates the **dev database**, not a
disposable one. This has happened before and wiped real dev data with no backup to
restore from.

**Always run e2e tests via the `test:e2e:docker` npm script**, which spins up a one-off
`api-test` container (wired to `db-test`), installs deps, resets/migrates `db-test`, then
runs the suite — never `docker exec` into the long-running `api` container:

```bash
pnpm test:e2e:docker -- <path-to-spec>   # e.g. tests/users/foo.e2e-spec.ts
```

If a previous run left `db-test` with stale open connections (`db:drop`/`db:create`
failing with "database is being accessed by other users"), clear them first:

```bash
docker exec db-test psql -U entourage_pro -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='entourage_pro_test';"
```

Before running any command that can mutate or reset a database (test runs, migrations,
seeders), verify which container/host is actually targeted — don't assume an env var
override changes the DB connection.

### In Claude Code Web / remote sandboxed sessions — Docker is unavailable

`pnpm test:e2e:docker` requires a working Docker daemon. In this remote sandbox, the
daemon cannot start at all (`service docker start` fails with
`ulimit: error setting limit (Operation not permitted)`), so this command will always
fail here — that's an environment limitation, not something to "fix" by retrying.

The safety invariant above still applies (never point at a real dev database), but the
disposable `db-test` container can be replaced with a locally-installed Postgres
instance, as long as it stays a throwaway test database:

1. `apt-get install -y postgresql-16-pgvector` — the `vector` extension isn't in the
   base `postgresql-16` package; migrations fail with `extension "vector" is not
   available` without it.
2. `service postgresql start`
3. `sudo -u postgres psql -c "CREATE USER entourage_pro WITH PASSWORD 'entourage_pro' SUPERUSER;"`
   and `sudo -u postgres psql -c "CREATE DATABASE entourage_pro_test OWNER entourage_pro;"`
4. Create a local `.env.test` (gitignored, never commit it) from `.env.dist`, with
   `DATABASE_URL=postgres://entourage_pro:entourage_pro@localhost:5432/entourage_pro_test`
   (`localhost`, not `db-test` — there's no docker-compose network here) and dummy
   values for the other secrets, mirroring what `.github/workflows/ci.yml`'s `e2e` job
   passes via GitHub secrets.
5. `NODE_ENV=dev-test pnpm db:migrate`
6. Run Jest directly, bypassing `docker-entrypoint.test.sh` entirely:
   `NODE_ENV=dev-test pnpm jest --config ./tests/jest-e2e.json --runInBand --forceExit [-t "<name>" | --testPathPattern=<dir>]`

The full e2e suite takes several minutes — run it in the background (long timeout)
rather than blocking on a short foreground command.

This workaround is specific to Docker-less remote sessions. When Docker *is* available
(local dev, or a future remote environment with a working daemon), keep using
`pnpm test:e2e:docker` as documented above instead.

## Cross-repo workflow

When a change touches an API endpoint, update both repos in the same session:

1. Update the controller/service here in `entourage-job-back`
2. Update the API type in `src/api/types.ts` and the consuming saga/hook in `entourage-job-front`
