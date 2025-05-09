'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('UserProfileSkills');
      await queryInterface.addColumn('Skills', 'userProfileId', {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'UserProfiles',
          key: 'id',
        },
      });
      await queryInterface.addColumn('Skills', 'order', {
        type: Sequelize.INTEGER,
        allowNull: false,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('Skills', 'order');
      await queryInterface.removeColumn('Skills', 'userProfileId');
      await queryInterface.createTable('UserProfileSkills', {
        id: {
          allowNull: false,
          primaryKey: true,
          type: Sequelize.UUID,
          defaultValue: () => {
            return UUID.v4();
          },
        },
        userProfileId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'UserProfiles',
            key: 'id',
          },
        },
        skillId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Skills',
            key: 'id',
          },
        },
        order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: -1,
        },
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
