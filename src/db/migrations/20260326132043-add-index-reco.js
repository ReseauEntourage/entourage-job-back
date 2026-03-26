'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Messages(conversationId, createdAt)
    await queryInterface.addIndex('Messages', ['conversationId', 'createdAt'], {
      name: 'messages_conversation_id_created_at_idx',
    });

    // Messages(conversationId, authorId, createdAt)
    await queryInterface.addIndex(
      'Messages',
      ['conversationId', 'authorId', 'createdAt'],
      {
        name: 'messages_conversation_id_author_id_created_at_idx',
      }
    );

    // ConversationParticipants(userId)
    await queryInterface.addIndex('ConversationParticipants', ['userId'], {
      name: 'conversation_participants_user_id_idx',
    });

    // ConversationParticipants(conversationId, userId)
    await queryInterface.addIndex(
      'ConversationParticipants',
      ['conversationId', 'userId'],
      {
        name: 'conversation_participants_conversation_id_user_id_idx',
      }
    );

    // UserProfileEmbeddings(userProfileId, type, configVersion)
    await queryInterface.addIndex(
      'UserProfileEmbeddings',
      ['userProfileId', 'type', 'configVersion'],
      {
        name: 'user_profile_embeddings_profile_id_type_version_idx',
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'Messages',
      'messages_conversation_id_created_at_idx'
    );
    await queryInterface.removeIndex(
      'Messages',
      'messages_conversation_id_author_id_created_at_idx'
    );
    await queryInterface.removeIndex(
      'ConversationParticipants',
      'conversation_participants_user_id_idx'
    );
    await queryInterface.removeIndex(
      'ConversationParticipants',
      'conversation_participants_conversation_id_user_id_idx'
    );
    await queryInterface.removeIndex(
      'UserProfileEmbeddings',
      'user_profile_embeddings_profile_id_type_version_idx'
    );
  },
};
