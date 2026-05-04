'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AiAssistantMessages', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      sessionId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'AiAssistantSessions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: {
        allowNull: false,
        type: Sequelize.ENUM('user', 'assistant'),
      },
      content: {
        allowNull: false,
        type: Sequelize.TEXT,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('AiAssistantMessages');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_AiAssistantMessages_role";');
  },
};
