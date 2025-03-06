'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('User_Social_Situations', {
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      materialInsecurity: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      networkInsecurity: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      hasCompletedSurvey: {
        type: Sequelize.BOOLEAN,
        default: false,
        allowNull: false,
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
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('User_Social_Situations');
  },
};
