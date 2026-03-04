'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserProfileEmbeddings', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      userProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'UserProfiles',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('profile', 'needs'),
        allowNull: false,
      },
      embedding: {
        type: 'vector(1536)',
        allowNull: false,
      },
      configVersion: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
    });

    await queryInterface.addIndex('UserProfileEmbeddings', [
      'userProfileId',
      'type',
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('UserProfileEmbeddings');
  },
};
