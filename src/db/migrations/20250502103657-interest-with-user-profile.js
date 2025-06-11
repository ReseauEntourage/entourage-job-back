'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.dropTable('UserProfileInterests');
    await queryInterface.addColumn('Interests', 'userProfileId', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'UserProfiles',
        key: 'id',
      },
    });
    await queryInterface.addColumn('Interests', 'order', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    await queryInterface.removeColumn('Interests', 'createdAt');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Interests', 'order');
    await queryInterface.addColumn('Interests', 'createdAt', {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    });
    await queryInterface.removeColumn('Interests', 'userProfileId');
    await queryInterface.createTable('UserProfileInterests', {
      userProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'UserProfiles',
          key: 'id',
        },
      },
      interestId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Interests',
          key: 'id',
        },
      },
    });
  },
};
