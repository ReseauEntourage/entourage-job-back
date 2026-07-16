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
| Use case | `annPoolSize` | `poolSize` | `filterByAvailability` |
|---|---|---|---|
| Recommendations | 200 | 200 | `true` |
| Network directory (relevance sort) | 500 | 500 | `isAvailable === true` |

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

## Cross-repo workflow

When a change touches an API endpoint, update both repos in the same session:
1. Update the controller/service here in `entourage-job-back`
2. Update the API type in `src/api/types.ts` and the consuming saga/hook in `entourage-job-front`
