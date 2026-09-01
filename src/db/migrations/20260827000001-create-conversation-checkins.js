'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ConversationCheckins', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      conversationId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: { model: 'Conversations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      stillInTouch: { allowNull: true, type: Sequelize.STRING },
      exchangeModes: {
        allowNull: true,
        type: Sequelize.ARRAY(Sequelize.STRING),
      },
      exchangeFrequency: { allowNull: true, type: Sequelize.STRING },
      perceivedBenefits: {
        allowNull: true,
        type: Sequelize.ARRAY(Sequelize.STRING),
      },
      employmentType: { allowNull: true, type: Sequelize.STRING },
      perceivedSupport: { allowNull: true, type: Sequelize.STRING },
      rating: { allowNull: true, type: Sequelize.INTEGER },
      comment: { allowNull: true, type: Sequelize.TEXT },
      contactRequestedAt: { allowNull: true, type: Sequelize.DATE },
      noteSentAt: { allowNull: true, type: Sequelize.DATE },
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

    await queryInterface.addIndex(
      'ConversationCheckins',
      ['conversationId', 'userId'],
      {
        unique: true,
        name: 'conversation_checkins_conversationId_userId_unique',
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'ConversationCheckins',
      'conversation_checkins_conversationId_userId_unique'
    );
    await queryInterface.dropTable('ConversationCheckins');
  },
};
