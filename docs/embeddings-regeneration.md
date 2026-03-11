# Régénération des embeddings

## Endpoint API Admin

Depuis la suppression du CLI, la régénération des embeddings se fait via un endpoint API admin.

### Endpoint

```
POST /embeddings/regenerate
```

**Authentification** : Bearer token (Admin uniquement)

### Paramètres de query

| Paramètre   | Type   | Description                                   | Défaut  |
| ----------- | ------ | --------------------------------------------- | ------- |
| `type`      | string | Type d'embeddings (`profile`, `needs`, `all`) | `all`   |
| `dryRun`    | string | Mode simulation (`true`/`false`)              | `false` |
| `batchSize` | string | Nombre d'utilisateurs par lot                 | `50`    |
| `delay`     | string | Délai en ms entre les lots                    | `100`   |

### Exemples d'utilisation

#### Régénérer tous les embeddings

```bash
curl -X POST "http://localhost:3000/embeddings/regenerate" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Mode simulation (dry-run)

Voir quels utilisateurs seraient affectés sans modifications :

```bash
curl -X POST "http://localhost:3000/embeddings/regenerate?dryRun=true" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Régénérer uniquement les embeddings de profil

```bash
curl -X POST "http://localhost:3000/embeddings/regenerate?type=profile" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Personnaliser les paramètres de traitement

```bash
curl -X POST "http://localhost:3000/embeddings/regenerate?batchSize=100&delay=200" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Réponse

```json
{
  "totalUsers": 150,
  "usersEnqueued": 150,
  "errors": 0
}
```

### Détails techniques

Le service identifie automatiquement les utilisateurs avec :

- Des embeddings obsolètes (version différente)
- Des embeddings manquants

Les utilisateurs sont ensuite ajoutés à la queue `embedding` pour traitement asynchrone par le worker.

#### Traitement batch optimisé

Pour respecter les rate limits de VoyageAI, le système utilise un traitement batch :

1. **Groupement des utilisateurs** : Les utilisateurs sont regroupés en lots (50 par défaut)
2. **Job batch unique** : Un seul job `UPDATE_USER_PROFILE_EMBEDDINGS_BATCH` est créé par lot
3. **Appels API optimisés** : Pour chaque lot et chaque type d'embedding :
   - Tous les textes sont préparés en une fois
   - Un seul appel à l'API VoyageAI est effectué pour tout le lot
   - Les résultats sont distribués aux utilisateurs correspondants

**Exemple d'optimisation** :

- **Avant** : 100 utilisateurs × 2 types = **200 appels API**
- **Après** : 2 lots × 2 types = **4 appels API** (réduction de 98%)

Cette approche permet de :

- Respecter les rate limits de VoyageAI
- Accélérer significativement le traitement
- Réduire les coûts d'API

**Note** : La taille du batch peut être ajustée selon les besoins et les limites de l'API VoyageAI.
