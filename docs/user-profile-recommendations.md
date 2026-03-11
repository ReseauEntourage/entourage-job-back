# Système de Recommandation de Profils Utilisateur

## Vue d'ensemble

Le système de recommandation d'Entourage permet de suggérer des profils d'utilisateurs (Coach ↔ Candidat) de manière intelligente et personnalisée. Ce système est conçu pour être extensible et modulaire, permettant l'implémentation de nouvelles stratégies de recommandation tout en maintenant une interface cohérente.

### Principes clés

- **Architecture modulaire** : Utilisation d'une classe abstraite de base permettant de créer facilement de nouvelles implémentations
- **Système de cache** : Les recommandations sont stockées et rafraîchies automatiquement selon certaines conditions
- **Bi-directionnel** : Les Candidats reçoivent des recommandations de Coachs et vice-versa
- **Configurable** : Les poids et paramètres de scoring sont configurables via des fichiers de configuration

---

## Architecture et Composants

### Structure du projet

```
src/user-profiles/recommendations/
├── user-profile-recommendation-base.ts           # Classe abstraite de base
├── user-profile-recommendations-legacy.service.ts # Implémentation Legacy
├── user-profile-recommendations-ai.service.ts     # Implémentation AI
├── scoring.config.ts                              # Configuration des poids et scores
└── user-profile-recommendation.types.ts           # Types TypeScript
```

### Diagramme de classes

```
┌────────────────────────────────────────┐
│  UserProfileRecommendationBase         │ (Abstract)
│  ────────────────────────────────────  │
│  + removeRecommendationsByUserId()     │
│  + findRecommendationsByUserId()       │
│  + createRecommendations()             │
│  + retrieveOrComputeRecommendations()  │
│  # updateRecommendationsByUserId() ⚡  │ (Abstract)
└────────────────────────────────────────┘
            ▲                    ▲
            │                    │
            │                    │
┌───────────┴──────────┐  ┌─────┴──────────────────────┐
│  LegacyService       │  │  AIService                 │
│  ──────────────────  │  │  ────────────────────────  │
│  + update...()       │  │  + update...()             │
│  (Score par métier   │  │  (Embeddings vectoriels +  │
│   et nudges)         │  │   similarité cosinus)      │
└──────────────────────┘  └────────────────────────────┘
```

---

## Classe Abstraite de Base : `UserProfileRecommendationBase`

### Rôle

La classe `UserProfileRecommendationBase` définit le contrat et les méthodes communes à toutes les implémentations du système de recommandation. Elle gère la logique de cache, de stockage et de récupération des recommandations.

### Méthodes fournies

#### `removeRecommendationsByUserId(userId: string)`

Supprime toutes les recommandations existantes pour un utilisateur donné.

#### `findRecommendationsByUserId(userId: string)`

Récupère les recommandations stockées pour un utilisateur avec toutes leurs relations (profil complet).

#### `createRecommendations(userId: string, usersToRecommendIds: string[])`

Crée des recommandations à partir d'une liste d'IDs d'utilisateurs.

#### `createRecommendationsFromUserProfileMatchingResult(userId: string, matchingResults: UserProfileMatchingResult[])`

Crée des recommandations à partir de résultats de matching incluant les scores et raisons.

#### `retrieveOrComputeRecommendationsForUserId(user: User, userProfile: UserProfile, poolSize = 3)`

**Méthode principale** : Récupère les recommandations depuis le cache ou les recalcule si nécessaire.

**Conditions de recalcul :**

- Aucune recommandation précédente
- Recommandations datant de plus d'une semaine
- Nombre de recommandations inférieur à `poolSize`
- Au moins une recommandation pointe vers un profil non disponible

### Méthode abstraite

#### `updateRecommendationsByUserId(userId: string, poolSize?: number): Promise<UserProfileRecommendation[]>`

**À implémenter** : Contient la logique métier de calcul des recommandations. Cette méthode doit :

1. Récupérer les données de l'utilisateur
2. Appliquer l'algorithme de recommandation
3. Retourner les recommandations créées

---

## Version Legacy : `UserProfileRecommendationsLegacyService`

### Description

La version legacy utilise un système de scoring basé sur la correspondance directe entre :

- **Business Sectors** (secteurs d'activité) : 30% du score
- **Nudges** (besoins/compétences) : 50% du score
- **Département** (même région) : critère de tri secondaire
- **Date de création** : critère de tri tertiaire

### Algorithme

1. **Récupération des critères de l'utilisateur**

   - Pour un utilisateur standard : récupération des nudges et secteurs d'activité du profil
   - Pour un administrateur d'entreprise : récupération des secteurs et département de l'entreprise

2. **Requête SQL**

   - Sélection des utilisateurs disponibles du rôle opposé (Coach/Candidat)
   - Dans la même région géographique
   - Avec dernière connexion non nulle

3. **Scoring en mémoire (via Lodash)**

   ```typescript
   score = matchingBusinessSectors * 0.3 + matchingNudges * 0.5;
   ```

4. **Tri multi-critères**

   - Par score décroissant
   - Par département exact (priorité locale)
   - Par date de création croissante (ancienneté)

5. **Limitation** : Retourne les `poolSize` premiers résultats

### Avantages

- ✅ Logique simple et compréhensible
- ✅ Rapide pour de petits ensembles de données
- ✅ Pas de dépendance externe (embeddings)

### Limitations

- ❌ Correspondance exacte uniquement (pas de notion de similarité sémantique)
- ❌ Ne prend pas en compte l'activité ou la disponibilité réelle des utilisateurs
- ❌ Tri en mémoire peu performant sur de gros volumes

---

## Version AI : `UserProfileRecommendationsService`

### Description

La version AI utilise des **embeddings vectoriels** (via OpenAI/VoyageAI) pour calculer la similarité sémantique entre profils. Elle intègre également des métriques d'activité et de disponibilité pour proposer des recommandations plus pertinentes et équilibrées.

### Architecture de Scoring

Le score final est composé de **4 critères principaux** :

| Critère                    | Poids | Description                                                             |
| -------------------------- | ----- | ----------------------------------------------------------------------- |
| **Profile Score**          | 30%   | Similarité du parcours professionnel (pondéré par la qualité du profil) |
| **Needs Score**            | 30%   | Correspondance des besoins/spécialisations                              |
| **Activity Score**         | 25%   | Réactivité et disponibilité actuelle                                    |
| **Location Compatibility** | 15%   | Compatibilité géographique et préférences d'événements                  |

#### 1. Profile Score (30%)

**Base** : Similarité cosinus entre les embeddings de profil (compétences, expériences, secteurs).

**Pondération par qualité** : Le score est multiplié par un coefficient de qualité du profil calculé sur 5 critères :

- Photo de profil (`hasPicture`)
- CV externe (`hasExternalCv`)
- URL LinkedIn (`linkedinUrl`)
- Description (`description`)
- Introduction (`introduction`)

**Formule** :

```
profileScore = cosineSimilarity(embedding_profile) × (criteresSatisfaits / 5)
```

#### 2. Needs Score (30%)

**Base** : Similarité cosinus entre les embeddings de besoins.

**Principe** : Les besoins d'un candidat doivent correspondre aux spécialisations d'un coach et vice-versa.

**Formule** :

```
needsScore = cosineSimilarity(embedding_needs)
```

#### 3. Activity Score (25%)

**Objectif** : Favoriser les utilisateurs actifs et réactifs tout en évitant de surcharger les plus sollicités.

**Composantes** (fenêtre de 30 jours) :

| Sous-critère        | Poids | Description                                                                       |
| ------------------- | ----- | --------------------------------------------------------------------------------- |
| **Response Rate**   | 50%   | Taux de réponse aux premiers messages                                             |
| **Response Time**   | 20%   | Vitesse de réponse (< 24h = 1.0, < 72h = 0.7, etc.)                               |
| **Last Connection** | 10%   | Fraîcheur de la dernière connexion (< 24h = 1.0, < 7j = 0.7, etc.)                |
| **Workload**        | 20%   | Charge de travail actuelle (pénalise les utilisateurs avec trop de conversations) |

**Formule** :

```
activityScore = LEAST(1.0, GREATEST(0.0,
  responseRate × 0.5 +
  responseTimeScore × 0.2 +
  lastConnectionScore × 0.1 +
  workloadScore × 0.2
))
```

**Note** : Les conversations avec les administrateurs sont exclues du calcul.

#### 4. Location Compatibility Score (15%)

**Objectif** : S'assurer que les utilisateurs peuvent se rencontrer selon leurs préférences.

**Composantes** :

| Sous-critère             | Poids | Description                                                      |
| ------------------------ | ----- | ---------------------------------------------------------------- |
| **Event Preferences**    | 60%   | Correspondance des types d'événements acceptés (physique/remote) |
| **Geographic Proximity** | 40%   | Proximité géographique si événements physiques autorisés         |

**Scoring des préférences d'événements** :

- Les deux acceptent le physique **ET** le remote : **1.0**
- Les deux acceptent le physique : **1.0**
- Les deux acceptent le remote : **1.0**
- Au moins une correspondance : **0.6**
- Aucune correspondance : **0.0**

**Scoring de la proximité géographique** (si physique autorisé) :

- Même zone géographique : **1.0**
- Zones différentes : **0.3**
- Non applicable (remote uniquement) : **0.5**

### Avantages

- ✅ Correspondance sémantique (au-delà des mots-clés exacts)
- ✅ Équilibrage automatique de la charge entre utilisateurs
- ✅ Favorise les utilisateurs actifs et réactifs
- ✅ Prise en compte de la qualité et complétude des profils
- ✅ Calcul performant en SQL (pas de post-traitement en mémoire)
- ✅ Raison dominante fournie pour chaque recommandation

### Limitations

- ⚠️ Dépendance aux embeddings (nécessite une génération préalable)
- ⚠️ Plus complexe à comprendre et déboguer
- ⚠️ Coûts liés à l'utilisation d'APIs d'embeddings

---

## Créer un Nouveau Système de Recommandation

Grâce à la classe abstraite `UserProfileRecommendationBase`, vous pouvez créer un nouveau système de recommandation en quelques étapes simples.

---

## Configuration et Personnalisation

### Fichier de configuration : `scoring.config.ts`

Tous les poids et paramètres de scoring sont centralisés dans ce fichier pour faciliter l'ajustement et l'expérimentation.

---

## Utilisation et API

### Endpoints disponibles

#### 1. Récupérer les recommandations (Legacy)

**Endpoint** : `GET /user/profile/recommendations`

**Authentification** : Bearer Token

**Service utilisé** : `UserProfileRecommendationsLegacyService`

#### 2. Récupérer les recommandations (AI)

**Endpoint** : `GET /user/profile/recommendations-ai`

**Authentification** : Bearer Token

**Service utilisé** : `UserProfileRecommendationsService`

---

## Régénération des Embeddings

### Vue d'ensemble

Lorsque la configuration des embeddings change (nouveaux champs, nouvelle version du modèle, etc.), il est nécessaire de régénérer les embeddings pour tous les utilisateurs afin qu'ils soient compatibles avec le nouveau système de recommandations.

Le système vérifie automatiquement la `configVersion` des embeddings lors de la génération des recommandations. Si un embedding a une version différente de celle configurée dans `EMBEDDING_CONFIG`, il ne sera pas utilisé dans les recommandations.

### Endpoint API de régénération

Un endpoint API admin est disponible pour identifier et régénérer automatiquement tous les embeddings obsolètes.

#### Endpoint

```
POST /embeddings/regenerate
```

**Authentification** : Bearer token (Admin uniquement)

**Paramètres de query** :

| Paramètre   | Type   | Description                                               | Valeur par défaut |
| ----------- | ------ | --------------------------------------------------------- | ----------------- |
| `type`      | string | Type d'embeddings à régénérer (`profile`, `needs`, `all`) | `all`             |
| `dryRun`    | string | Mode simulation (`true`/`false`)                          | `false`           |
| `batchSize` | string | Nombre d'utilisateurs par lot                             | `50`              |
| `delay`     | string | Délai en ms entre les lots                                | `100`             |

#### Utilisation

##### Régénérer tous les embeddings

```bash
curl -X POST "https://api.example.com/embeddings/regenerate?type=all" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

##### Mode dry-run (simulation)

Voir quels utilisateurs seraient affectés sans effectuer réellement la régénération :

```bash
curl -X POST "https://api.example.com/embeddings/regenerate?dryRun=true" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

##### Régénérer uniquement les embeddings de profil

```bash
curl -X POST "https://api.example.com/embeddings/regenerate?type=profile" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

##### Régénérer uniquement les embeddings de besoins

```bash
curl -X POST "https://api.example.com/embeddings/regenerate?type=needs" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

##### Options avancées

Personnaliser la taille des lots et le délai entre les lots :

```bash
curl -X POST "https://api.example.com/embeddings/regenerate?batchSize=100&delay=200" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Réponse** :

```json
{
  "totalUsers": 150,
  "usersEnqueued": 150,
  "errors": 0
}
```

#### Comment ça fonctionne ?

1. **Identification** : L'endpoint interroge la base de données pour trouver tous les utilisateurs dont les embeddings :

   - Ont une `configVersion` différente de celle définie dans `EMBEDDING_CONFIG`
   - Sont totalement absents

2. **Mise en queue** : Les utilisateurs identifiés sont ajoutés à la queue d'embeddings par lots (50 par défaut)

3. **Traitement asynchrone** : Le worker queue traite les embeddings en arrière-plan via le job existant `UPDATE_USER_PROFILE_EMBEDDINGS`

4. **Génération** : Pour chaque utilisateur, les embeddings sont régénérés via l'API VoyageAI et stockés avec la nouvelle `configVersion`

#### Bonnes pratiques

- ✅ **Toujours faire un dry-run d'abord** pour estimer le nombre d'utilisateurs concernés
- ✅ **Vérifier les stats** avant et après la régénération
- ✅ **Surveiller les logs** du worker pendant le traitement
- ✅ **Exécuter pendant les heures creuses** pour éviter de surcharger l'API VoyageAI
- ⚠️ **Attention aux quotas API** : chaque embedding génère un appel à VoyageAI

#### Résolution de problèmes

**Problème** : Certains utilisateurs restent avec des embeddings obsolètes

**Solutions** :

- Vérifier que le worker queue est actif
- Consulter les logs d'erreur du worker
- Vérifier les quotas de l'API VoyageAI
- Réexécuter l'outil après avoir corrigé les erreurs

**Problème** : Le script se termine immédiatement sans rien faire

**Solutions** :

- Vérifier que la base de données est accessible
- Vérifier que les variables d'environnement sont correctement configurées
- Exécuter avec `--stats` pour voir l'état actuel

---

## FAQ

### Pourquoi deux versions (Legacy et AI) ?

La version Legacy est conservée pour :

- La rétrocompatibilité
- La comparaison et validation de la nouvelle approche AI

### Comment sont générés les embeddings ?

Les embeddings sont générés automatiquement lors de la création/mise à jour d'un profil via le service `VoyageAiModule` qui appelle l'API VoyageAI.

### Quelle est la fréquence de rafraîchissement des recommandations ?

Les recommandations sont recalculées :

- Automatiquement après 1 semaine
- Si le nombre de recommandations est inférieur à `poolSize`

### Comment déboguer des recommandations incorrectes ?

1. Vérifiez les embeddings de l'utilisateur
2. Exécutez la requête SQL manuellement avec des logs des scores intermédiaires
3. Vérifiez les poids dans `scoring.config.ts`
4. Analysez la raison dominante (`dominantReason`) pour identifier le facteur principal

---

## Conclusion

Le système de recommandation d'Entourage est conçu pour être à la fois puissant et flexible. Grâce à son architecture modulaire basée sur une classe abstraite, vous pouvez facilement :

- ✅ Créer de nouvelles stratégies de recommandation
- ✅ Comparer différentes approches
- ✅ Ajuster les poids et paramètres selon vos besoins
- ✅ Maintenir plusieurs versions en parallèle
