'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AiAssistantSessions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      conversationId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Conversations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex(
      'AiAssistantSessions',
      ['conversationId', 'userId'],
      { unique: true, name: 'ai_assistant_sessions_conversation_user_unique' }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'AiAssistantSessions',
      'ai_assistant_sessions_conversation_user_unique'
    );
    await queryInterface.dropTable('AiAssistantSessions');
  },
};
