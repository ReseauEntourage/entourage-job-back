🗒️ **Ticket Jira :** [EN-XXXX](https://entourage-asso.atlassian.net/browse/EN-XXXX)
📐 **Specs :** ReseauEntourage/entourage-specs#XXX · change `<nom-du-change>`
🚧 **PR Front :** ReseauEntourage/entourage-job-front#XXX

<!--
Replace XXX with the PR numbers: GitHub turns `owner/repo#123` into a link and shows the PR title and state on hover.
📐 Specs: the entourage-specs PR carries the why and the how (proposal.md, design.md, specs, tasks.md); design is reviewed there.
  Link the PR rather than the change folder, which moves under changes/archive/ when the change is archived.
  No OpenSpec change (hotfix, version bump…): write « aucun » and explain why in « En bref ».
🚧 PR Front: delete the line if this PR only touches this repo.
-->

## 💬 En bref

<!-- 1 to 3 lines: what this PR changes on the back side. Do not copy the design, it lives in the specs PR. -->

## 🔍 Points d'attention

<!-- What deserves the reviewer's attention: deviation from design.md, non-obvious implementation choice, fragile area. « RAS » otherwise. -->

## 🚀 Déploiement

<!-- Tick what applies. -->

- [ ] Migration Sequelize (`src/db/migrations/`) — avec un `down` fonctionnel
- [ ] Nouvelle variable d'environnement — ajoutée à `.env.dist`, à créer sur Heroku (staging et prod) avant le déploiement
- [ ] Contrat d'API modifié — à merger avant la PR front, compatible avec le front actuellement en prod le temps du déploiement
- [ ] Rien de particulier
