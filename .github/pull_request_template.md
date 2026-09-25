| | |
|:--|:--|
| 🗒️ **Ticket Jira** | [EN-XXXX](https://entourage-asso.atlassian.net/browse/EN-XXXX) |
| 📐 **Specs** | ReseauEntourage/entourage-specs#XXX · change `<nom-du-change>` |
| 🚧 **PR Front** | ReseauEntourage/entourage-job-front#XXX |

<!--
Remplacer XXX par les numéros de PR : GitHub transforme `owner/repo#123` en lien et affiche le titre et l'état de la PR au survol.
📐 Specs : la PR entourage-specs porte le pourquoi et le comment (proposal.md, design.md, specs, tasks.md) ; c'est là que se relit la conception.
  On lie la PR plutôt que le dossier du change, qui est déplacé sous changes/archive/ à l'archivage.
  Pas de change OpenSpec (hotfix, montée de version…) : écrire « aucun » et dire pourquoi dans « En bref ».
🚧 PR Front : supprimer la ligne si la PR ne touche que ce repo.
-->

## 💬 En bref

<!-- 1 à 3 lignes : ce que change cette PR côté back. Ne pas recopier la conception, elle est dans la PR specs. -->

## 🔍 Points d'attention

<!-- Ce qui mérite l'œil du reviewer : écart avec design.md, choix d'implémentation non évident, zone fragile. « RAS » sinon. -->

## 🚀 Déploiement

<!-- Cocher ce qui s'applique. -->

- [ ] Migration Sequelize (`src/db/migrations/`) — avec un `down` fonctionnel
- [ ] Nouvelle variable d'environnement — ajoutée à `.env.dist`, à créer sur Heroku (staging et prod) avant le déploiement
- [ ] Contrat d'API modifié — à merger avant la PR front, compatible avec le front actuellement en prod le temps du déploiement
- [ ] Rien de particulier
