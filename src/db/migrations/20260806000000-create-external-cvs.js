'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ExternalCvs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
        allowNull: false,
      },
      userProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'UserProfiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      mediaId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Medias', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
      deletedAt: { allowNull: true, type: Sequelize.DATE },
    });

    // Supports the "current CV" lookup:
    // WHERE userProfileId = ? AND deletedAt IS NULL ORDER BY createdAt DESC
    await queryInterface.addIndex('ExternalCvs', [
      'userProfileId',
      'deletedAt',
      'createdAt',
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('ExternalCvs');
  },
};
