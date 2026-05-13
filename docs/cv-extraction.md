# Extraction CV → Profil utilisateur — Documentation

Le pipeline d'extraction permet à un candidat d'importer son CV en PDF. L'IA analyse le document et pré-remplit automatiquement son profil Entourage Pro (description, compétences, expériences, formations, langues, centres d'intérêt).

---

## Partie fonctionnelle

### À quoi ça sert ?

Un candidat dont le profil est vide ou incomplet peut importer son CV PDF. Le système extrait automatiquement les informations et les reporte dans les champs correspondants de son profil. L'objectif est de réduire la friction de complétion du profil, notamment lors de l'onboarding.

> **Important :** cet import ne remplace pas le CV partagé en pièce jointe dans une conversation. Le profil pré-rempli sert à donner du contexte aux coachs dans l'annuaire et dans l'assistant IA — ce n'est pas le document envoyé aux recruteurs.

### Ce qui est extrait

| Champ extrait | Destination sur le profil |
|---|---|
| Résumé (1ère personne, max 500 caractères) | Description / accroche professionnelle |
| Compétences | Liste des compétences |
| Expériences professionnelles | Titre, entreprise, lieu, dates, description |
| Formations | Titre, institution, lieu, dates, description |
| Langues parlées | Langue + niveau (notions / intermédiaire / courant / natif) |
| Centres d'intérêt | Liste des intérêts |

### Comment ça se passe pour l'utilisateur ?

1. L'utilisateur importe son CV en PDF (depuis l'onboarding ou ses paramètres de profil)
2. Un message de confirmation d'upload apparaît
3. Le traitement IA démarre immédiatement en arrière-plan — l'utilisateur voit un indicateur de chargement animé
4. Quelques secondes plus tard, une notification confirme que le profil a été mis à jour
5. Les champs sont pré-remplis — l'utilisateur peut les modifier librement

Si le même CV est importé une deuxième fois sans modification, le traitement IA ne s'exécute pas à nouveau : les données déjà extraites sont réutilisées directement.

### Écrasement des données existantes

Si l'utilisateur a déjà rempli son profil, les champs extraits du CV **écrasent les valeurs existantes**. Un avertissement est affiché dans l'interface avant de lancer la génération lorsque cette situation est détectée.

### Mentions légales

L'interface affiche une mention légale informant l'utilisateur que ses données sont traitées par OpenAI pour générer son profil, et que celles-ci sont ensuite conservées par Entourage Pro conformément à la politique de confidentialité.

---

## Partie technique

### Architecture générale

```
POST /external-cv                        ← upload du PDF
  │
  └── ExternalCvsService.uploadExternalCV()
        ├── S3 upload → external-cvs/{userId}.pdf
        ├── UserProfile.hasExternalCv = true
        └── ExtractedCVData.destroy() ← invalide le cache précédent

GET /profile-generation/generate-profile-from-cv
  │
  └── ProfileGenerationController.generateFromPDF()
        ├── Télécharge le PDF depuis S3
        ├── Hash MD5 du contenu binaire
        ├── shouldExtractCV() → vérifie hash + schemaVersion
        │
        ├── [si nouvelle extraction nécessaire]
        │     └── generateProfileFromPDF() → BullMQ job GENERATE_PROFILE_FROM_PDF
        │           └── ProfileGeneratorProcessor.handleProfileGeneration()
        │                 ├── Télécharge PDF depuis S3
        │                 ├── convertPDFToImages() → pdftocairo → PNG base64[]
        │                 ├── OpenAiService.extractCVFromImages() → CvSchemaType
        │                 ├── saveExtractedCVData() → ExtractedCVData (upsert)
        │                 ├── populateUserProfileFromCVData() → UserProfile update
        │                 └── PusherService.sendEvent(PROFILE_GENERATION_COMPLETE)
        │
        └── [si extraction en cache]
              ├── getExtractedCVData() → CvSchemaType depuis ExtractedCVData
              └── populateUserProfileFromCVData() → UserProfile update
```

### Étape 1 — Upload du CV

**Endpoint :** `POST /external-cv`
**Fichiers :** `src/external-cvs/external-cvs.controller.ts`, `src/external-cvs/external-cvs.service.ts`

Le fichier est reçu par `FileInterceptor` (Multer, stockage local temporaire dans `uploads/`), puis :

1. Uploadé sur S3 à la clé `external-cvs/{userId}.pdf` (écrase tout fichier précédent)
2. `UserProfile.hasExternalCv` passé à `true`
3. L'entrée `ExtractedCVData` existante est **détruite** pour invalider le cache d'extraction précédent
4. Le fichier temporaire local est supprimé dans le `finally`

**Retour :** `{ url: <signed URL S3> }` pour affichage immédiat du PDF.

### Étape 2 — Déclenchement de l'extraction

**Endpoint :** `GET /profile-generation/generate-profile-from-cv`
**Fichier :** `src/profile-generation/profile-generation.controller.ts`

Le contrôleur :

1. Vérifie que `userProfile.hasExternalCv === true`, sinon `404`
2. Télécharge le PDF depuis S3 en mémoire (arraybuffer via axios)
3. Calcule le **hash MD5** du contenu binaire
4. Appelle `shouldExtractCV(userProfileId, fileHash)` :
   - Aucune donnée en base → extraction nécessaire
   - Hash différent → le fichier a changé, extraction nécessaire
   - `schemaVersion` différente de `SCHEMA_VERSION` (actuellement `5`) → le schéma a évolué, extraction nécessaire
   - Sinon → pas d'extraction, données en cache réutilisées
5. Si extraction nécessaire → enqueue le job BullMQ
6. Si cache valide → `getExtractedCVData()` puis `populateUserProfileFromCVData()` directement (synchrone)

### Étape 3 — Traitement asynchrone (Worker)

**Fichier :** `src/queues/consumers/profile-generator.processor.ts`
**Queue :** `profile-generation`
**Job :** `GENERATE_PROFILE_FROM_PDF`

**Configuration de la queue :**

| Paramètre | Valeur |
|---|---|
| Priorité | `HIGH (1)` — traitée avant les jobs de travail standard |
| Tentatives | 3 |
| Backoff | Exponentiel, délai initial 10 secondes |
| `removeOnFail` | `false` — jobs échoués conservés pour inspection |
| `removeOnComplete` | `true` |

**Payload du job (`GenerateProfileFromPDFJob`) :**

```typescript
{
  s3Key: string;        // ex: "external-cvs/{userId}.pdf"
  userProfileId: string;
  userId: string;
  fileHash: string;     // hash MD5 pour traçabilité
}
```

**Progression rapportée via `job.updateProgress()` :**

| Étape | Progression |
|---|---|
| Démarrage | 10 % |
| Fin de conversion PDF → images | 30 % |
| Fin d'extraction OpenAI | 80 % |
| Fin de peuplement du profil | 90 % |
| Terminé | 100 % |

**Gestion des fichiers temporaires :**

Le PDF est téléchargé dans `os.tmpdir()` (ou `/tmp` sur macOS) sous un nom unique `{timestamp}_{random}.pdf`. Les images PNG converties sont placées dans un sous-dossier `entourage_pdf_convert_{uniqueId}/`. Tous les fichiers sont supprimés dans les blocs `finally` pour éviter toute fuite.

**En cas d'erreur :** l'événement Pusher `PROFILE_GENERATION_COMPLETE` est quand même émis avec `{ success: false, error: <message> }` pour informer le front-end.

### Étape 4 — Conversion PDF → images

**Méthode :** `convertPDFToImages(pdfPath)` dans `ProfileGeneratorProcessor`
**Dépendance système :** `pdftocairo` (bibliothèque Poppler)

Commande exécutée via `execFile` :

```bash
pdftocairo -png -scale-to 1024 <input.pdf> <output_dir>/converted
```

- `-png` : sortie en PNG
- `-scale-to 1024` : largeur maximale de 1 024 pixels (préserve le ratio)
- Chaque page produit un fichier `converted-{N}.png`
- Les fichiers sont triés par numéro de page, lus en base64 et retournés comme `string[]`
- Timeout de 60 secondes

**Détection du binaire :** `detectPdftocairoPath()` (`src/utils/misc/pdf-to-cairo.ts`) localise `pdftocairo` dans le `PATH` système.

### Étape 5 — Extraction IA (OpenAI)

**Fichier :** `src/external-services/openai/openai.service.ts`
**Modèle :** `o4-mini-2025-04-16`
**Max tokens :** `OPENAI_MAX_COMPLETION_TOKENS` (variable d'environnement, défaut 4 096)

Chaque image PNG (page du CV) est envoyée en `image_url` base64 dans un seul appel `chat.completions.create`. Le **tool calling forcé** garantit une réponse JSON structurée :

```typescript
tools: [{ type: 'function', function: { name: 'extract_cv_data', parameters: cvSchema } }]
tool_choice: { type: 'function', function: { name: 'extract_cv_data' } }
```

**Gestion de `finish_reason === 'length'` :** si OpenAI coupe la réponse par limite de tokens, une erreur explicite est levée avec les détails d'usage pour faciliter le diagnostic (réduire la résolution des images ou augmenter `OPENAI_MAX_COMPLETION_TOKENS`).

#### Schéma d'extraction (`openai.schemas.ts`) — version `SCHEMA_VERSION = 5`

| Champ | Type | Contraintes |
|---|---|---|
| `description` | `string` | max 500 chars, rédigé à la 1ère personne |
| `skills[]` | `{ name, order? }` | max 50 items, name max 80 chars |
| `experiences[]` | `{ title, company?, description?, location?, startDate?, endDate?, order?, skills[] }` | dates ISO YYYY-MM-DD |
| `formations[]` | `{ title, institution?, description?, location?, startDate?, endDate?, skills[] }` | dates ISO YYYY-MM-DD |
| `languages[]` | `{ name, value, level? }` | value = code ISO 639-1 (ex: `en`), level = `NOTIONS \| INTERMEDIATE \| FLUENT \| NATIVE` |
| `interests[]` | `{ name }` | max 10 items |

La `schemaVersion` est incrémentée à chaque modification du schéma. Tout enregistrement `ExtractedCVData` avec une version inférieure à `SCHEMA_VERSION` déclenche une nouvelle extraction au prochain appel.

### Étape 6 — Persistance des données extraites

**Méthode :** `ProfileGenerationService.saveExtractedCVData()`
**Modèle :** `ExtractedCVData`

Upsert sur `userProfileId` :
- Si une entrée existe → `update({ data, fileHash, schemaVersion })`
- Sinon → `create({ userProfileId, data, fileHash, schemaVersion })`

**Table `ExtractedCVData` :**

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | UUID PK | auto-généré |
| `userProfileId` | UUID FK | → `UserProfiles.id`, NOT NULL |
| `data` | JSONB | données extraites au format `CvSchemaType` |
| `fileHash` | STRING | hash MD5 du PDF |
| `schemaVersion` | INTEGER | version du schéma au moment de l'extraction |

**Migration :** `20250519120000-create-extracted-cv-data.js`

### Étape 7 — Peuplement du profil utilisateur

**Méthode :** `ProfileGenerationService.populateUserProfileFromCVData(userId, cvData)`

Construit un `UserProfileDto` partiel depuis `CvSchemaType` puis appelle `userProfileService.updateByUserId()` :

| Champ CV | Traitement | Destination profil |
|---|---|---|
| `description` | Copie directe | `UserProfile.description` |
| `skills[]` | Mapping `{ name, userProfileSkill: { order } }` | `UserProfile.skills` |
| `experiences[]` | Parse des dates ISO → `Date` (fallback `new Date()` si invalide) | `UserProfile.experiences` |
| `formations[]` | Parse des dates ISO → `Date` (fallback `new Date()` si invalide) | `UserProfile.formations` |
| `interests[]` | Mapping `{ name }` | `UserProfile.interests` |
| `languages[]` | Lookup `LanguagesService.findByValue(code ISO)` → `UserProfileLanguage` | `UserProfile.userProfileLanguages` |

Les langues font l'objet d'une résolution en base : le code ISO 639-1 extrait par l'IA (`en`, `fr`, `es`…) est résolu en `Language` via `languagesService.findByValue()`. Si la langue n'est pas trouvée dans le référentiel, elle est ignorée silencieusement.

### Étape 8 — Notification temps réel (Pusher)

À la fin du traitement (succès ou échec), le worker émet un événement Pusher :

- **Canal :** `PROFILE_GENERATION-{userId}` (canal privé par utilisateur)
- **Événement :** `PROFILE_GENERATION_COMPLETE`
- **Payload succès :** `{ success: true, jobId, userProfileId }`
- **Payload erreur :** `{ success: false, error: <message>, jobId, userProfileId }`

### Front-end

#### Hook `useProfileGeneration` — `src/hooks/useProfileGeneration.ts`

Expose deux éléments :

| Retour | Type | Description |
|---|---|---|
| `generateProfileFromCV` | `() => Promise<void>` | Déclenche `GET /profile-generation/generate-profile-from-cv` et passe `isLoading` à `true` |
| `isLoading` | `boolean` | `true` pendant toute la durée du traitement |

**Abonnement Pusher :** monté dans un `useEffect` sur `userId`. À la réception de `PROFILE_GENERATION_COMPLETE` :
- Succès → notification toast `success`, dispatch `fetchCurrentProfileCompleteRequested`, appel `onProfileGenerated()`
- Erreur → notification toast `danger`
- Dans les deux cas → `setIsLoading(false)`

Le canal est désabonné au démontage du composant.

#### Composant `ProfileGenerationProcess` — `src/features/backoffice/profile/ProfileGenerationProcess/`

Composant avec `forwardRef` exposant `{ generateProfileFromCV }` via `useImperativeHandle`. Permet aux parents de déclencher la génération programmatiquement (ex: automatiquement après un upload de CV réussi dans `CvCompletionAccordion`).

Affiche :
- Un avertissement si `overwriteWarning === true` (données existantes qui seront écrasées)
- L'illustration du CV ou `ProfileGenerationLoadingIndicator` (GIF animé `/static/img/illustrations/cv-ia.gif`) pendant le traitement
- Le bouton "Générer mon profil avec l'IA" (désactivé pendant `isLoading`)
- La mention légale OpenAI

#### Points d'entrée dans l'interface

| Contexte | Composant | Comportement |
|---|---|---|
| Onboarding (accordéon CV) | `CvCompletionAccordion` | Upload → génération automatique enchaînée, synchronisation des champs du formulaire |
| Paramètres de profil | `GenerateProfileConfirmModal` | Modal de confirmation, bouton explicite |

### Endpoints API

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `POST` | `/external-cv` | Utilisateur authentifié | Upload du PDF vers S3, invalide le cache |
| `GET` | `/external-cv/:userId` | Utilisateur authentifié | URL signée S3 pour visualiser le CV |
| `DELETE` | `/external-cv` | Utilisateur authentifié | Supprime le flag `hasExternalCv` |
| `GET` | `/profile-generation/generate-profile-from-cv` | Utilisateur authentifié | Déclenche le pipeline (ou réutilise le cache) |

### Variables d'environnement

| Variable | Requis | Description |
|---|---|---|
| `OPENAI_API_KEY` | Oui | Clé API OpenAI |
| `OPENAI_MAX_COMPLETION_TOKENS` | Non | Budget tokens pour l'extraction (défaut : 4 096) |
| `AWSS3_BUCKET_NAME` | Oui | Nom du bucket S3 |
| `AWSS3_FILE_DIRECTORY` | Oui | Préfixe de chemin S3 |

### Dépendances

**Back-end :**
```json
"openai": "^4.98.0"
```

**Système (doit être installé sur le serveur) :**
```
poppler-utils  →  fournit le binaire pdftocairo
```

### Évolution du schéma

Pour modifier les champs extraits par OpenAI :

1. Modifier `cvSchema` dans `src/external-services/openai/openai.schemas.ts`
2. Mettre à jour l'interface `CvSchemaType` en conséquence
3. **Incrémenter `SCHEMA_VERSION`** — tous les enregistrements `ExtractedCVData` existants auront une version périmée et déclencheront une nouvelle extraction au prochain appel utilisateur
