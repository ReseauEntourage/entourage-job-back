'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('UserProfileShares', {
      id: {
        type: Sequelize.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
        allowNull: false,
      },
      sharedUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      sharingUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      channel: {
        type: Sequelize.ENUM('linkedin', 'whatsapp'),
        allowNull: false,
      },
      postUrl: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('UserProfileShares', ['sharedUserId']);
    await queryInterface.addIndex('UserProfileShares', ['sharingUserId']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('UserProfileShares');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_UserProfileShares_channel";'
    );
  },
};
