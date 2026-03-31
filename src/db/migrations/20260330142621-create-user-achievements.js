'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserAchievements', {
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
      userId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      achievementType: {
        allowNull: false,
        type: Sequelize.ENUM('super_engaged_coach'),
      },
      expireAt: {
        allowNull: true,
        type: Sequelize.DATE,
      },
      active: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
    });

    await queryInterface.addIndex('UserAchievements', ['userId']);
    await queryInterface.addIndex(
      'UserAchievements',
      ['userId', 'achievementType', 'active'],
      {
        name: 'user_achievements_userId_type_active',
        unique: true,
        where: { active: true },
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('UserAchievements', ['userId']);
    await queryInterface.removeIndex(
      'UserAchievements',
      'user_achievements_userId_type_active'
    );
    await queryInterface.dropTable('UserAchievements');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_UserAchievements_achievementType";'
    );
  },
};
