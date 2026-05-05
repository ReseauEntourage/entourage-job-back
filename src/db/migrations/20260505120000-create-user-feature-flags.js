'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserFeatureFlags', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      featureKey: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      enabled: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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

    await queryInterface.addIndex('UserFeatureFlags', ['userId']);
    await queryInterface.addIndex(
      'UserFeatureFlags',
      ['userId', 'featureKey'],
      {
        unique: true,
        name: 'user_feature_flags_userId_featureKey_unique',
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'UserFeatureFlags',
      'user_feature_flags_userId_featureKey_unique'
    );
    await queryInterface.removeIndex('UserFeatureFlags', ['userId']);
    await queryInterface.dropTable('UserFeatureFlags');
  },
};
