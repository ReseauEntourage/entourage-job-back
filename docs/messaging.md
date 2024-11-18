# Documentation Technique de la Messagerie

## Introduction

La messagerie de l'application est divisée en deux parties principales : `ExternalMessage` et `Messaging`. La partie `InternalMessage` est désormais dépréciée et remplacée par le module `Messaging`. Cette documentation explique les raisons de cette transition et fournit des détails techniques sur la mise en œuvre des deux systèmes de messagerie.

## ExternalMessage

### Description

`ExternalMessage` permet l'envoi de courriels à des candidats de la plateforme par des personnes complètement externes à la plateforme. Ce système est utilisé pour faciliter la communication entre les candidats et les recruteurs ou autres parties intéressées qui ne sont pas inscrites sur la plateforme.

### Fonctionnalités

- **Création de messages externes** : Les utilisateurs externes peuvent envoyer des messages aux candidats.
- **Validation des messages** : Les messages sont validés pour s'assurer qu'ils contiennent des informations correctes et complètes.
- **Envoi de courriels** : Les messages sont envoyés par courriel aux candidats.
- **Notification par courriel** : Les candidats reçoivent une notification par courriel lorsqu'ils reçoivent un message externe.

### Modèles et DTOs

- **Modèle** : `ExternalMessage`
- **DTO** : `CreateExternalMessageDto`

### Service

Le service `MessagesService` gère la logique métier pour la création et l'envoi de messages externes.

## InternalMessage - DESACTIVATED

A l'origine, les `InternalMessage` fonctionnaient exactement commes les `ExternalMessage` càd qu'ils n'étaient que de simple courriels envoyés au candidats ou coachs.
Ils n'apportaient pas suffisament de latitude pour comprendre les usages fait de cette fonctionnalité. Ils pouvaient représenter des problèmes de vulnérabilité pour les utilisteurs car les conversations n'avaient plus lieu au sein de notre plateforme.

## Messaging

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
