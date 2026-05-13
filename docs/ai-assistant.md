# Assistant IA de coaching — Documentation

L'assistant IA est un panneau de chat intégré à l'interface backoffice. Il aide les coachs à préparer et améliorer leurs échanges avec leurs candidats, en s'appuyant sur le profil du candidat et l'historique de leur conversation.

---

## Partie fonctionnelle

### À quoi ça sert ?

Quand un coach ouvre une conversation avec un candidat, il peut ouvrir un panneau latéral "Assistant Coach". Il peut y poser des questions en langage naturel et obtenir des conseils personnalisés : comment relancer le candidat, comment comprendre son secteur, comment préparer un entretien, etc.

L'assistant ne s'adresse qu'au coach — il ne communique jamais directement avec le candidat. Il peut en revanche rédiger des messages prêts à envoyer, que le coach peut utiliser d'un clic.

### Ce que l'assistant peut faire

- Résumer la conversation coach-candidat
- Proposer un message de relance adapté au contexte
- Rédiger un premier message d'accroche si aucun échange n'a encore eu lieu
- Faire un brief sur le secteur ou le métier visé par le candidat
- Proposer une réponse au dernier message du candidat
- Répondre à toute question libre sur l'accompagnement

### Les suggestions de messages

Quand l'assistant propose un message à envoyer au candidat, celui-ci apparaît dans un bloc cliquable distinct. En cliquant dessus, le texte est automatiquement copié dans la zone de saisie de la messagerie — le coach n'a plus qu'à envoyer ou ajuster.

Les messages suggérés respectent le registre de tutoiement ou de vouvoiement utilisé par le coach dans la conversation, et sont rédigés dans la langue de la conversation si elle est différente du français.

### Les suggestions rapides

Pour éviter d'avoir à formuler une question, quatre boutons de suggestions rapides sont disponibles en permanence. L'un d'eux est contextuel : il propose de "Démarrer la discussion" si aucun message n'a encore été échangé, ou "Proposer une réponse" si la conversation est déjà entamée.

| Suggestion | Ce qu'elle fait |
|---|---|
| Démarrer la discussion *(contextuel, sans historique)* | Propose un premier message bienveillant à envoyer au candidat |
| Proposer une réponse *(contextuel, avec historique)* | Rédige une réponse adaptée au dernier message du candidat |
| Relancer le candidat | Propose un message de relance pour un candidat silencieux |
| Comprendre le secteur | Brief sur le secteur visé : métiers, attentes recruteurs, vocabulaire |
| Résumer la conversation | Synthèse de l'échange : besoins, attentes, état d'esprit du candidat |

### Limites d'utilisation

L'assistant est limité à **10 messages par heure et par coach**. Une alerte apparaît lorsqu'il reste 2 messages ou moins. Une fois la limite atteinte, la saisie est bloquée jusqu'à la réinitialisation de la fenêtre.

### Escalade vers un référent

Si l'assistant détecte que la situation décrite nécessite l'intervention d'un référent Entourage Pro (situation sociale difficile, détresse personnelle, sujet hors périmètre du coaching), une carte d'alerte s'affiche avec le nom du référent et un bouton pour ouvrir directement une conversation avec lui.

### Réinitialiser l'historique

Le coach peut effacer l'historique de ses échanges avec l'assistant (sans affecter la conversation avec le candidat) via le bouton de réinitialisation. Cela permet de repartir d'un contexte vierge.

### Ce que l'assistant ne fait pas

- Il ne s'adresse jamais directement au candidat
- Il ne fait pas de diagnostic social, psychologique ou juridique
- Il ne garantit aucun résultat (emploi, entretien réussi, etc.)
- Il renvoie vers le référent Entourage Pro pour tout sujet dépassant le périmètre du coaching

---

## Partie technique

### Architecture générale

```
Coach (front-end)
  │
  ├── GET  /ai-assistant/conversations/:id/session       ← historique des messages
  ├── POST /ai-assistant/conversations/:id/stream        ← SSE (streaming)
  └── DELETE /ai-assistant/conversations/:id/session/messages  ← reset

Back-end
  ├── AiAssistantController   → routing + guard UserInConversation
  └── AiAssistantService
        ├── Redis              → rate limiting (INCR + EXPIRE)
        ├── MessagingService   → 10 derniers messages de la conversation
        ├── UserProfileModel   → profil complet du candidat
        ├── AnthropicService   → streaming claude-sonnet-4-6
        │     └── LlmMetricsService  → Datadog DogStatsD
        └── AnthropicService   → classification claude-haiku-4-5 (escalade)

PostgreSQL
  ├── AiAssistantSessions
  └── AiAssistantMessages
```

### Endpoints API

**Fichier :** `src/ai-assistant/ai-assistant.controller.ts`

Tous les endpoints sont protégés par le guard `UserInConversation` (vérifie que l'appelant participe bien à la conversation).

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/ai-assistant/conversations/:conversationId/session` | Retourne la session et ses messages, ou `{ messages: [] }` si aucune session n'existe |
| `POST` + `@Sse()` | `/ai-assistant/conversations/:conversationId/stream` | Démarre le streaming SSE d'une réponse |
| `DELETE` | `/ai-assistant/conversations/:conversationId/session/messages` | Supprime tous les messages de la session — répond 204 |

Le corps du POST est validé par `AiStreamPipe` → `AiStreamDto` : `message: string` (requis, max 12 000 caractères).

### Flux d'exécution du streaming

**Fichier :** `src/ai-assistant/ai-assistant.service.ts`

La méthode `streamResponse()` retourne un `Observable<MessageEvent>` (RxJS). Les erreurs non gérées sont transformées en événement SSE `{ error }` suivi de `[DONE]`.

Étapes de `doStream()` dans l'ordre :

```
1.  Charger le coach (avec son organisation)
2.  Vérifier que le caller n'est pas un CANDIDATE → 401
3.  checkRateLimit(userId) via Redis
    ├── Dépassé → émettre { type: 'rate_limit', resetInSeconds } → [DONE]
    └── Autorisé → émettre { type: 'rate_limit_info', remaining }
4.  getOrCreateSession(conversationId, userId)
5.  Charger la conversation + ses 10 derniers messages (MessagingService)
    → 404 si introuvable
6.  Identifier le candidat parmi les participants (role === CANDIDATE)
7.  Charger le profil candidat (sectorOccupations, skills, experiences, formations)
8.  Charger l'historique de messages IA de la session (order ASC)
9.  Persister le message utilisateur en base (role: 'user')
10. buildSystemBlocks() → 2 blocs de prompt (voir ci-dessous)
11. Construire la liste de messages Anthropic :
    ├── Historique existant (dernier message marqué cache_control: ephemeral)
    └── Nouveau message utilisateur
12. anthropicService.createStream() → itérer sur les deltas
    └── Pour chaque text_delta → émettre { content: chunk }
13. stream.finalMessage() → enregistrer les métriques tokens (Datadog)
14. Parser les balises [SUGGESTION]...[/SUGGESTION] dans la réponse complète
    └── Si suggestions trouvées → émettre { type: 'suggest', suggestions: string[] }
15. Persister la réponse complète en base (role: 'assistant')
16. checkEscalation(fullText) via Claude Haiku
    └── Si OUI → résoudre staffContact.entourageProEmail → émettre { type: 'escalate', referentUserId, referentName }
17. Émettre [DONE] → subscriber.complete()
```

### Rate limiting

**Implémentation :** Redis INCR + EXPIRE

| Paramètre | Valeur |
|---|---|
| Clé Redis | `RL_AI_ASSISTANT:<userId>` |
| Limite | 10 messages par fenêtre |
| Fenêtre | 3 600 secondes (1 heure glissante) |

`INCR` atomique ; `EXPIRE` posé uniquement sur le premier incrément (`count === 1`) pour ne pas réinitialiser la fenêtre à chaque appel. Le TTL courant est retourné pour calculer `resetInSeconds`.

### Construction du prompt système

**Méthode :** `buildSystemBlocks()` dans `AiAssistantService`

Retourne deux `TextBlockParam` Anthropic :

**Bloc 1 — statique (mis en cache 1 heure)**

Contenu invariant entre les messages d'une même session, éligible au prompt caching Anthropic (`cache_control: { type: 'ephemeral', ttl: '1h' }`) :

```
Rôle de l'assistant
CONTEXTE DE LA PLATEFORME
CHARTE ÉTHIQUE DE LA COMMUNAUTÉ
POSTURE DE COACHING
MISSIONS DES ACCOMPAGNANTS
FICHES MÉTIERS ROME
BOÎTE À OUTILS COACHS ENTOURAGE PRO
Date du jour (fr-FR)
Identité et organisation du coach
Profil complet du candidat (secteurs, métiers, compétences, expériences, formations)
Section profil adaptative (voir ci-dessous)
PRIORITÉS DE DÉCOUVERTE
CAS DIFFICILES
RÈGLES STRICTES
FORMAT DES MESSAGES SUGGÉRÉS
Few-shot example
```

**Logique de la section profil :**

| Situation | Contenu injecté |
|---|---|
| Tous les champs vides | `emptyProfileInstruction` — invite à importer un CV |
| Profil partiellement rempli | `profileInstruction` + `missingFieldsNote` (liste des champs manquants) |
| Profil complet | `profileInstruction` seul |

**Bloc 2 — dynamique (jamais mis en cache)**

10 derniers messages de la conversation de messagerie, avec horodatage et nom de l'auteur. Change à chaque message.

**Placeholders substitués à l'exécution :**

| Placeholder | Valeur |
|---|---|
| `{{USER_NAME}}` | Prénom et nom du coach |
| `{{CANDIDATE_NAME}}` | Prénom et nom du candidat |
| `{{MISSING_FIELDS}}` | Liste des champs de profil non renseignés |
| `{{TEXT}}` | Texte complet de la réponse (classificateur d'escalade uniquement) |

### Prompt caching Anthropic

Le bloc 1 (statique) est marqué `cache_control: { type: 'ephemeral', ttl: '1h' }`. Son contenu ne change pas entre les messages d'une même session, ce qui permet à Anthropic de le servir depuis le cache et réduit significativement les coûts en tokens d'entrée.

Pour l'historique des messages IA, le **dernier message existant** est marqué `cache_control: { type: 'ephemeral' }` (TTL 5 min par défaut). Cela couvre l'intégralité de l'historique IA précédent sur chaque nouvel appel.

Les tokens économisés sont tracés via `cache_read_input_tokens` et `cache_creation_input_tokens` dans Datadog.

### Détection d'escalade

Après avoir reçu la réponse complète, `checkEscalation()` appelle Claude Haiku avec un classificateur binaire :

```
System : "Tu es un classificateur de sécurité. Réponds uniquement par OUI ou NON."
Prompt : "La réponse suivante suggère-t-elle une intervention d'un référent Entourage Pro ?\n\n<texte complet>"
```

- Modèle : `claude-haiku-4-5-20251001`, max 5 tokens
- Si la réponse commence par `OUI` → résoudre `candidateUser.staffContact.entourageProEmail` → émettre `{ type: 'escalate', referentUserId, referentName }`
- En cas d'erreur dans la classification → `false` silencieux, pour ne pas bloquer la réponse principale

### Service Anthropic

**Fichier :** `src/external-services/anthropic/anthropic.service.ts`

```typescript
// Streaming (réponse principale)
createStream(systemBlocks: TextBlockParam[], messages: MessageParam[])
// Modèle : claude-sonnet-4-6  |  max_tokens : 1 024

// Génération synchrone (classificateur d'escalade)
generateText(systemPrompt, userMessage, maxTokens = 5): Promise<string>
// Modèle : claude-haiku-4-5-20251001  |  max_tokens : 5
```

### Protocole SSE — format des événements

Le back-end émet des `MessageEvent` NestJS au format SSE standard (`data: <JSON>\n\n`).

| Événement | Moment d'émission | Description |
|---|---|---|
| `{ type: 'rate_limit_info', remaining }` | En premier, avant tout contenu | Nombre de messages restants dans la fenêtre |
| `{ content: string }` | En continu pendant le stream | Chunk de texte de la réponse |
| `{ type: 'suggest', suggestions: string[] }` | En fin de stream | Messages à envoyer au candidat (extraits des balises `[SUGGESTION]`) |
| `{ type: 'escalate', referentUserId, referentName }` | En fin de stream si détecté | Identité du référent à contacter |
| `{ type: 'rate_limit', resetInSeconds }` | À la place du contenu si limite atteinte | Temps avant réinitialisation de la fenêtre |
| `{ error: string }` | En cas d'erreur | Message d'erreur générique |
| `[DONE]` | Toujours en dernier | Signal de fin du stream |

### Modèles de données

**`AiAssistantSession`** — table `AiAssistantSessions`

Une session par paire `(conversationId, userId)`, créée à la première interaction via `findOrCreate`.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID PK | auto-généré |
| `conversationId` | UUID FK | → `Conversations.id`, NOT NULL |
| `userId` | UUID FK | → `Users.id`, NOT NULL |
| `createdAt` | TIMESTAMP | auto |
| `updatedAt` | TIMESTAMP | auto |

**`AiAssistantMessage`** — table `AiAssistantMessages`

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID PK | auto-généré |
| `sessionId` | UUID FK | → `AiAssistantSessions.id`, NOT NULL |
| `role` | ENUM | `'user'` ou `'assistant'`, NOT NULL |
| `content` | TEXT | NOT NULL (inclut les balises `[SUGGESTION]` brutes) |
| `createdAt` | TIMESTAMP | auto |
| `updatedAt` | TIMESTAMP | auto |

**Migrations :** `20260427120000-create-ai-assistant-sessions.js`, `20260427120001-create-ai-assistant-messages.js`

### Métriques LLM

**Fichier :** `src/external-services/llm-metrics/llm-metrics.service.ts`

Métriques DogStatsD envoyées à Datadog après chaque appel :

| Métrique | Description |
|---|---|
| `ai.tokens.input` | Tokens d'entrée |
| `ai.tokens.output` | Tokens de sortie |
| `ai.tokens.cache_read` | Tokens lus depuis le cache Anthropic |
| `ai.tokens.cache_write` | Tokens écrits dans le cache Anthropic |

Tags : `model`, `provider: 'anthropic'`, `operation` (`stream` ou `classify`), `feature: 'ai_assistant'`.

### Configuration du prompt

**Fichier :** `src/ai-assistant/ai-assistant.config.ts`

L'objet `AI_ASSISTANT_CONFIG` est la source unique de vérité du contenu du prompt. **Pour modifier le comportement de l'IA, c'est ici qu'il faut intervenir.**

| Clé | Description |
|---|---|
| `role` | Définition du rôle et de la mission de l'assistant |
| `platformContext` | Contexte Entourage Pro + distinction import CV vs partage CV |
| `ethicalCharter` | Valeurs, comportements interdits, gestion des données personnelles |
| `coachingPhilosophy` | Posture coach, écoute active, autonomie, humilité |
| `coachingScope` | Liste des axes d'intervention du coach |
| `romeResources` | Instruction pour lier les fiches ROME France Travail |
| `toolboxResources` | Boîte à outils Notion (20+ ressources catégorisées) |
| `profileInstruction` | Instruction quand le profil candidat est rempli |
| `missingFieldsNote` | Complément quand des champs sont manquants |
| `emptyProfileInstruction` | Instruction quand le profil est entièrement vide |
| `discoveryPriorities` | Ordre de priorité : projet pro → outils de candidature → échéances |
| `difficultSituations` | Gestion des sujets hors périmètre (social, administratif) |
| `rules` | 7 règles strictes de comportement (langue, format, limites) |
| `suggestionFormat` | Instructions de format pour les balises `[SUGGESTION]` |
| `escalationClassifierSystem` / `escalationClassifierPrompt` | Prompt du classificateur d'escalade |
| `fewShotExample` | Exemple de réponse correcte avec message suggéré |

### Front-end

**Arborescence :**

```
src/features/backoffice/messaging/MessagingAIPanel/
├── MessagingAIPanel.tsx              ← conteneur + onglets
├── MessagingAIPanel.styles.ts        ← styled-components
├── MessagingAIAssistant.tsx          ← logique chat principale
├── MessagingAIAssistant.utils.ts     ← parser SSE + définition des actions rapides
├── MessagingAIAssitant.types.ts      ← types TypeScript
└── AssistantMessageBubble/
    └── AssistantMessageBubble.tsx    ← rendu Markdown + boutons suggestion
```

#### `MessagingAIAssistant` — état local

| Variable | Type | Rôle |
|---|---|---|
| `messages` | `AiAssistantMessage[]` | Messages affichés dans le fil |
| `isLoading` | `boolean` | Streaming en cours |
| `inputValue` | `string` | Contenu du textarea |
| `escalation` | `EscalationState \| null` | Référent à contacter |
| `rateLimitRemaining` | `number \| null` | Messages restants |
| `rateLimitResetAt` | `number \| null` | Timestamp (ms) de reset |

**Flux d'envoi (`sendMessage`) :**

1. Guards : contenu vide / `isLoading` / pas de `conversationId` / rate limited → no-op
2. Ajouter optimistement le message user + bulle assistant vide (id temporaire)
3. Appel `Api.streamAIMessage()` — fetch natif (pas axios), retourne un `Response`
4. Lire le `ReadableStream` via `response.body.getReader()`
5. Déléguer à `processSSEStream()` avec les callbacks
6. `finally` → `setIsLoading(false)`

**Suggestions :** `onUseSuggestion(text)` dispatche `messagingActions.setNewMessage(text)` pour pré-remplir la zone de saisie de la messagerie principale.

**Escalade :** le bouton "Contacter le référent" appelle `router.push('/backoffice/messaging?userId=<referentUserId>')`.

#### Parser SSE — `processSSEStream()`

Lit le `ReadableStream` par chunks via `TextDecoder({ stream: true })`. Accumule les lignes incomplètes entre les chunks et dispatche chaque événement vers le callback correspondant (voir table des événements SSE ci-dessus).

#### `AssistantMessageBubble` — rendu des réponses

`parseSegments(content)` découpe le texte en segments alternés selon les balises `[SUGGESTION]...[/SUGGESTION]` :

| Segment | Rendu |
|---|---|
| `text` | `marked.parse()` → HTML · `DOMPurify.sanitize()` → `dangerouslySetInnerHTML` |
| `suggestion` | `<Button>` cliquable → `onUseSuggestion(content)` |

Les blocs `[SUGGESTION]` incomplets (en cours de streaming) sont détectés et ignorés pour éviter un affichage partiel.

### Feature flag

L'accès à l'assistant est conditionné par `FeatureKey.MESSAGING_AI_ASSISTANT`. Le bouton d'ouverture du panneau est dans `MessagingConversationHeader`. L'état ouvert/fermé est géré dans le slice Redux `messaging` via `setIsAIPanelOpen()`.

### Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Oui | Clé API Anthropic pour le SDK |

### Dépendances

**Back-end :**
```json
"@anthropic-ai/sdk": "^0.91.1"
```

**Front-end :**
```json
"marked"     // Markdown → HTML (rendu des réponses)
"dompurify"  // Sanitisation XSS du HTML généré
```
