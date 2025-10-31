# Documentation Technique de la Messagerie

### Description

Le module `Messaging` remplace l'ancien système `InternalMessage` pour fournir une messagerie interne plus robuste et flexible. Ce module permet aux utilisateurs de la plateforme de communiquer entre eux directement via des conversations internes.

### Fonctionnalités

- **Création de conversations** : Les utilisateurs peuvent créer des conversations internes.
- **Envoi de messages** : Les utilisateurs peuvent envoyer des messages dans des conversations internes.
- **Semi temps-réel**: Pour des raisons de facilité cette messagerie donne l'impression d'une messagerie en temps-réel sans en être vraiment une.
- **Gestion des participants** : Les conversations peuvent inclure plusieurs participants.
- **Notifications** : Les utilisateurs reçoivent des notifications lorsqu'ils reçoivent de nouveaux messages.

### Modèles et DTOs

- **Modèles** : `Conversation`, `Message`, `ConversationParticipant`
- **DTOs** : `CreateMessageDto`

### Service

Le service `MessagingService` gère la logique métier pour la création et la gestion des conversations et des messages internes.

### Conclusion

D'autres informations sur la partie front-end de la messagerie sont situés dans le repository `entourage-job-front` => `docs/messaging.md`
