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
