# Système de Recommandation de Profils — Documentation

---

## Partie fonctionnelle

### Qu'est-ce que c'est ?

Lorsqu'un coach ou un candidat accède à l'annuaire, la plateforme lui présente des profils pertinents triés par ordre de pertinence. Ce tri est calculé par le système de recommandation : il analyse les profils de tous les utilisateurs compatibles et retourne une liste personnalisée, du plus au moins pertinent.

Le système fonctionne dans les deux sens : un candidat reçoit des suggestions de coachs, et un coach reçoit des suggestions de candidats.

### Sur quoi repose la pertinence ?

Quatre critères entrent en jeu pour calculer le score final d'un profil recommandé :

| Critère | Poids | Ce que ça mesure |
|---|---|---|
| **Similarité de parcours** | 40 % | À quel point le profil professionnel du candidat (expériences, compétences, formations) ressemble à ce que le coach peut accompagner |
| **Correspondance des besoins** | 20 % | À quel point les secteurs visés et les coups de pouce du candidat correspondent aux spécialisations du coach |
| **Activité et réactivité** | 30 % | Est-ce que l'utilisateur est disponible, réactif et pas surchargé ? |
| **Proximité géographique** | 10 % | Sont-ils dans la même zone ? |

### Comment l'activité est-elle évaluée ?

L'activité est le critère le plus nuancé. Il est lui-même composé de cinq sous-critères calculés sur les 30 derniers jours :

| Sous-critère | Poids | Détail |
|---|---|---|
| **Taux de réponse** | 35 % | Proportion des conversations auxquelles l'utilisateur a répondu au premier message |
| **Vitesse de réponse** | 15 % | < 24h → excellent · < 72h → bien · < 120h → moyen · au-delà → faible |
| **Fraîcheur de connexion** | 5 % | < 24h → excellent · < 7j → bien · < 30j → moyen · au-delà → faible |
| **Charge actuelle** | 15 % | 0 conv. → pleinement disponible · 1–3 → très dispo · 4–5 → dispo · 6–8 → chargé · 9+ → très chargé |
| **Badge super_engaged_coach** | 30 % | Bonus maximal accordé aux coachs ayant obtenu ce badge d'engagement |

> Ce dernier sous-critère est exclusif aux coachs. Pour les candidats, il ne contribue pas au score.

### Que signifie la "raison dominante" ?

Chaque recommandation est accompagnée d'une raison dominante : `PROFILE`, `NEEDS` ou `ACTIVITY`. Cette raison indique sur quel critère le profil recommandé se distingue le plus des autres résultats. Elle est calculée par comparaison relative entre tous les candidats du lot — ce n'est pas une valeur absolue.

La compatibilité géographique n'est pas prise en compte pour la raison dominante car c'est une valeur binaire (même zone / zone différente) qui ne différencie pas significativement les profils.

### Qui est éligible à apparaître dans mes recommandations ?

Un profil peut apparaître uniquement si :
- Il est du rôle opposé (candidat pour un coach, coach pour un candidat)
- Son onboarding est complété
- Son compte n'est pas supprimé
- Il n'y a pas encore de conversation existante entre les deux utilisateurs

En plus, une règle géographique s'applique en amont : si l'un des deux utilisateurs n'accepte que les échanges en présentiel, seuls les utilisateurs de la même zone géographique sont éligibles. Si les deux acceptent les échanges à distance, la contrainte de zone disparaît (mais la proximité reste un avantage de 10 %).

### Comment la liste se rafraîchit-elle ?

Les recommandations sont calculées une fois, puis mises en cache. Elles sont recalculées automatiquement dans l'un des cas suivants :

- Aucune recommandation n'a encore été générée (première visite)
- Les recommandations datent de plus d'une semaine
- Au moins un profil recommandé n'est plus disponible
- La liste est issue d'une ancienne version du système (sans score ni rang)

En dehors de ces cas, les recommandations sont servies depuis le cache pour des raisons de performance.

### Comment fonctionne la pagination ?

La liste est infinie et chargée par pages. Chaque page retourne un curseur qui permet de charger les profils suivants. En arrière-plan, le système commence à préparer les prochains résultats avant que l'utilisateur ne les atteigne.

---

## Partie technique

### Architecture générale

```
Profil mis à jour
  │
  └── enqueueUserProfileEmbeddingsUpdate()
        └── BullMQ Job: UPDATE_USER_PROFILE_EMBEDDINGS
              └── EmbeddingBuilder.build()
                    └── VoyageAiService.generateEmbedding()
                          └── UserProfileEmbedding (pgvector, 1024D)

GET /user/profile/recommendations
  │
  └── UserProfileRecommendationsService
        ├── ensureFreshPool()
        │     ├── [si stale] removeRecommendationsByUserId()
        │     └── updateRecommendationsByUserId() → findBySimilarity() → persist
        └── findRecommendationsByUserId(cursor, limit)
              └── [si proche de l'épuisement] appendRecommendationsForUserId() [bg]
```

### Embeddings

**Fichiers :** `src/embeddings/`

#### Configuration — `embedding.config.ts`

Deux types d'embeddings sont générés par profil :

| Type | Version | Champs du profil |
|---|---|---|
| `profile` | v3.0 | `currentJob`, `description`, `introduction`, `skills`, `experiences`, `formations`, `languages` |
| `needs` | v2.0 | `sectorOccupations`, `nudges`, `customNudges` |

- **Modèle :** `voyage-4-lite` (VoyageAI)
- **Dimensions :** 1 024
- La `configVersion` est stockée avec chaque embedding. Tout embedding dont la version ne correspond pas à `EMBEDDING_CONFIG` est ignoré lors du matching.

#### Construction du texte — `embedding.builder.ts`

`EmbeddingBuilder.build(userRole, profile, type)` sérialise les champs du profil en texte structuré (format clé : valeur en français) avant envoi à VoyageAI. Points notables :

- Les expériences incluent titre, entreprise, lieu, durée calculée (en années / mois via Moment.js) et compétences associées
- Les nudges sont sérialisés selon le rôle : `nameRequest` pour les candidats, `nameOffer` pour les coachs
- Les champs vides sont filtrés et ne contribuent pas au texte

#### Déclenchement de la mise à jour

Lors de chaque mise à jour de profil, `enqueueUserProfileEmbeddingsUpdate()` détermine quels types d'embeddings sont affectés en comparant les champs modifiés aux champs déclarés dans `EMBEDDING_CONFIG`. Seuls les types affectés sont re-générés.

La queue BullMQ `EMBEDDING` est limitée à **1 job par minute** pour respecter les rate limits de VoyageAI.

#### Persistance — `UserProfileEmbedding`

Table `UserProfileEmbeddings` :

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID PK | auto-généré |
| `userProfileId` | UUID FK | → `UserProfiles.id`, NOT NULL |
| `type` | ENUM | `'profile'` ou `'needs'` |
| `embedding` | `vector(1024)` | pgvector, NOT NULL |
| `configVersion` | STRING | version de la config au moment de la génération |

Index :
- **HNSW** sur `embedding` avec `vector_cosine_ops` → exploité par les requêtes `ORDER BY <=>` dans le matching
- Index composite `(userProfileId, type)` → lookup rapide des vecteurs d'un utilisateur

### Service de recommandation AI — `user-profile-recommendations-ai.service.ts`

#### Constantes

```typescript
ANN_POOL_SIZE    = 200   // candidats pré-filtrés par ANN avant scoring complet
INITIAL_POOL_SIZE = 50   // taille du premier lot stocké
APPEND_BATCH_SIZE = 50   // taille de chaque lot suivant (refill)
```

#### Flux principal : `findBySimilarity()`

1. `fetchCurrentUserVectors()` — récupère les vecteurs `profile` et `needs` de l'utilisateur courant depuis `UserProfileEmbeddings` (filtrés par `configVersion`)
2. Si aucun vecteur disponible → retourne `[]`
3. `buildSimilarityQuery()` — construit la requête SQL à 4 CTEs (voir ci-dessous)
4. Exécution via `sequelize.query()` avec `QueryTypes.SELECT`
5. Retourne un tableau de `UserProfileScoringResult`

#### Structure SQL : 4 CTEs + SELECT final

```sql
WITH
  top_by_profile AS (…),   -- ANN sur embedding 'profile'
  top_by_needs   AS (…),   -- ANN sur embedding 'needs'
  candidate_pool AS (…),   -- fusion des deux pools
  user_scores    AS (…)    -- calcul de tous les scores
SELECT … FROM user_scores ORDER BY "finalScore" DESC LIMIT :poolSize
```

**`top_by_profile` / `top_by_needs`**

Pré-sélection des 200 candidats les plus proches par distance cosinus, en exploitant l'index HNSW :

```sql
SELECT up."userId", 1 - (upe.embedding <=> '<vecteur_courant>'::vector) AS profile_score
FROM "UserProfileEmbeddings" upe
JOIN "UserProfiles" up ON …
JOIN "Users" u ON …
WHERE upe.type = 'profile'
  AND upe."configVersion" = :configVersionProfile
  AND u.role IN (<rôles cibles>)
  AND u."onboardingStatus" = 'COMPLETED'
  AND u.id != :userId
ORDER BY upe.embedding <=> '<vecteur_courant>'::vector   -- ← déclenche le HNSW
LIMIT :annPoolSize
```

> Les vecteurs sont interpolés directement dans la chaîne SQL (format `'[0.1,...,0.9]'::vector`) pour que l'opérateur `<=>` puisse exploiter l'index HNSW. Les paramètres nommés (`:userId`, etc.) ne peuvent pas être utilisés avec `ORDER BY <=>`.

**`candidate_pool`**

Fusion des deux pools via `FULL OUTER JOIN` pour conserver les candidats présents dans un seul des deux pools :

```sql
SELECT COALESCE(p."userId", n."userId") AS "userId",
       COALESCE(p.profile_score, 0)     AS profile_score,
       COALESCE(n.needs_score, 0)       AS needs_score
FROM top_by_profile p
FULL OUTER JOIN top_by_needs n ON n."userId" = p."userId"
```

**`user_scores`**

Calcul de tous les scores pour les candidats du pool. Contient :

- Les scores `profile_score` et `needs_score` issus du pool ANN
- Le calcul de `activity_score` (voir ci-dessous)
- Le calcul de `location_compatibility_score`
- Les filtres éliminatoires :
  - **Géographique :** `(current_user.allowRemoteEvents = true AND candidate.allowRemoteEvents = true) OR candidate.zone = current_user.zone`
  - **Pas de conversation existante :** `NOT EXISTS (SELECT 1 FROM ConversationParticipants … WHERE cp_cur.userId = :userId)`

**`activity_score` — LATERAL subquery**

Calcul restreint aux candidats du pool (pas de scan global) sur une fenêtre de 30 jours :

```sql
LEFT JOIN (
  SELECT cp_receiver."userId",
    COUNT(CASE WHEN response.id IS NOT NULL THEN 1 END)::float
      / NULLIF(COUNT(DISTINCT c.id), 0) AS response_rate,
    AVG(EXTRACT(EPOCH FROM (response."createdAt" - first_msg."createdAt")) / 3600)
      AS avg_response_hours,
    COUNT(DISTINCT c.id) AS active_conversations_count
  FROM "Conversations" c
  JOIN "ConversationParticipants" cp_receiver
    ON cp_receiver."userId" IN (SELECT "userId" FROM candidate_pool)
  JOIN LATERAL (SELECT … FROM "Messages" … ORDER BY createdAt ASC LIMIT 1) first_msg ON true
  LEFT JOIN LATERAL (SELECT … FROM "Messages" … WHERE authorId = cp_receiver.userId … LIMIT 1) response ON true
  WHERE c."createdAt" >= NOW() - INTERVAL '30 days'
    AND u_other.role != 'Admin'   -- conversations avec admins exclues
  GROUP BY cp_receiver."userId"
) activity ON activity.user_id = cand."userId"
```

Formule complète de l'`activity_score` (CASE avec breakpoints issus de `scoring.config.ts`) :

```sql
LEAST(1.0, GREATEST(0.0,
  COALESCE(response_rate, 0.5)               * 0.35
  + CASE avg_response_hours
      WHEN <= 24  THEN 1.0
      WHEN <= 72  THEN 0.7
      WHEN <= 120 THEN 0.4
      ELSE 0.1
    END                                        * 0.15
  + CASE EXTRACT(DAY FROM NOW() - lastConnection)
      WHEN <= 1  THEN 1.0
      WHEN <= 7  THEN 0.7
      WHEN <= 30 THEN 0.3
      ELSE 0.1
    END                                        * 0.05
  + CASE active_conversations_count
      WHEN <= 0 THEN 1.0
      WHEN <= 3 THEN 0.9
      WHEN <= 5 THEN 0.7
      WHEN <= 8 THEN 0.4
      ELSE 0.2
    END                                        * 0.15
  + CASE WHEN badge 'super_engaged_coach' actif THEN 1.0 ELSE 0.0 END * 0.30
))
```

**SELECT final**

```sql
SELECT "userId", profile_score, needs_score, activity_score, location_compatibility_score,
  (profile_score * :weightProfile + needs_score * :weightNeeds
   + activity_score * :weightActivity
   + location_compatibility_score * :weightLocationCompatibility) AS "finalScore"
FROM user_scores
WHERE profile_score > 0 OR needs_score > 0
ORDER BY "finalScore" DESC
LIMIT :poolSize
```

#### Raison dominante — `computeRelativeReasons()`

Pour chaque résultat, la raison dominante est déterminée par **normalisation min-max relative** entre tous les résultats du lot (3 critères : `profile`, `needs`, `activity`) :

```
relativeScore(critère, candidat) = ((score_candidat - min_lot) / (max_lot - min_lot)) × poids
```

Le critère avec le `relativeScore` le plus élevé devient la raison dominante. La compatibilité géographique est exclue de ce calcul (valeur binaire non discriminante).

Cas dégénéré (un seul résultat) : fallback sur la comparaison absolue des scores pondérés.

#### Gestion du pool — `ensureFreshPool()`

Conditions déclenchant un recalcul complet :

```
!lastRecommendationsDate          → première génération
lastRecommendationsDate < (now - 1 semaine)
currentRecos.length === 0
any(r.recUser.userProfile.isAvailable === false)   → profil devenu indisponible
any(r.finalScore === null OR r.rank === null)       → enregistrement legacy
```

Si le recalcul est déclenché : suppression de toutes les recommandations existantes → `updateRecommendationsByUserId(userId, 50)`.

#### Refill incrémental — `appendRecommendationsForUserId()`

Lorsque l'utilisateur a consommé suffisamment de recommandations, un job de refill en arrière-plan calcule les 50 suivantes en passant les `recommendedUserId` déjà stockés dans `excludeUserIds` pour ne pas doubler les résultats. Les nouveaux enregistrements sont persistés avec `startRank = max(rank) + 1`.

### Classe abstraite — `user-profile-recommendation-base.ts`

Contient la logique commune aux deux implémentations (AI et Legacy) :

| Méthode | Description |
|---|---|
| `findRecommendationsByUserId(userId, { cursor, limit })` | Lecture paginée par `rank ASC` avec filtre `rank > cursor` |
| `countRecommendationsByUserId(userId)` | Comptage pour décider le refill |
| `getStoredRecommendationsMeta(userId)` | Lecture légère (sans JOIN profil) pour construire `excludeUserIds` |
| `createRecommendationsFromUserProfileMatchingResult(userId, results, startRank)` | Bulk insert avec scores, raison et rang |
| `removeRecommendationsByUserId(userId)` | Suppression de toutes les recommandations |
| `updateRecommendationsByUserId()` | **Abstraite** — à implémenter dans chaque sous-classe |

### Modèle de données — `UserProfileRecommendation`

Table `UserProfileRecommendations` :

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID PK | auto-généré |
| `UserId` | UUID FK | → `Users.id` (qui reçoit la reco) |
| `recommendedUserId` | UUID FK | → `Users.id` (profil recommandé) |
| `reason` | ENUM | `PROFILE`, `NEEDS`, `ACTIVITY`, `LOCATION_COMPATIBILITY` |
| `profileScore` | FLOAT | score brut de similarité de parcours |
| `needsScore` | FLOAT | score brut de similarité de besoins |
| `activityScore` | FLOAT | score brut d'activité |
| `locationCompatibilityScore` | FLOAT | `1.0` (même zone) ou `0.5` (zones compatibles) |
| `finalScore` | FLOAT | score pondéré final |
| `rank` | INTEGER | position dans la pool triée |

Index composite `(UserId, rank)` → optimise la lecture paginée.

### Endpoints

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/user/profile/recommendations?limit=20&cursor=0` | Utilisateur authentifié | Retourne la page courante de recommandations avec `nextCursor` |
| `GET` | `/user/profile/recommendations-ai/:userId?forceRefresh=true&poolSize=3` | Admin uniquement | Recommandations pour un utilisateur arbitraire, recalcul forcé possible |
| `GET` | `/user/profile?sort=relevance` | Utilisateur authentifié | Annuaire trié par similarité (hybrid search : ANN + filtres multi-critères) |

### Régénération des embeddings — `embeddings-regeneration.service.ts`

Endpoint admin `POST /embeddings/regenerate` :

| Paramètre | Défaut | Description |
|---|---|---|
| `type` | `all` | `profile`, `needs` ou `all` |
| `dryRun` | `false` | Simulation sans écriture |
| `batchSize` | `50` (max 50) | Utilisateurs par lot |
| `delay` | `100` ms | Délai entre les lots |

**Optimisation batch :** pour un lot de 50 utilisateurs et 2 types d'embeddings, le service effectue **2 appels** à VoyageAI (un par type) au lieu de 100. Chaque appel `generateEmbeddingsBatch()` envoie tous les textes du lot en une seule requête.

Réponse :

```json
{ "totalUsers": 150, "usersEnqueued": 150, "errors": 0 }
```

### Configuration des poids — `scoring.config.ts`

Source unique de vérité pour tous les paramètres numériques. Modifier ce fichier suffit pour ajuster le comportement du scoring sans toucher à la logique SQL.

```typescript
SCORING_WEIGHTS        = { profile: 0.40, needs: 0.20, activity: 0.30, locationCompatibility: 0.10 }
ACTIVITY_SCORING_CONFIG.weights = { responseRate: 0.35, responseTime: 0.15, lastConnection: 0.05, workload: 0.15, superEngagedCoach: 0.30 }
LOCATION_COMPATIBILITY_CONFIG   = { sameZone: 1.0, differentZone: 0.5 }
```

### Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `VOYAGE_API_KEY` | Oui | Clé API VoyageAI pour la génération d'embeddings |

### Dépendances

```json
"voyageai": "^0.2.1"
```

Extension PostgreSQL requise : `pgvector` (activée via migration `20260304125754-enable-pgvector.js`).

### Service Legacy

`UserProfileRecommendationsLegacyService` est encore présent dans le code mais **n'est exposé par aucun endpoint**. Il utilise un scoring par correspondance exacte de secteurs (30 %) et nudges (50 %), sans embeddings. Il est conservé pour comparaison historique.
