'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RecruitementAlertsNotifiedCandidates', {
      recruitementAlertId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'RecruitementAlerts',
          key: 'id',
        },
        primaryKey: true,
      },
      userId: {
        allowNull: false,
        type: Sequelize.UUID,
        references: {
          model: 'Users',
          key: 'id',
        },
        primaryKey: true,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('RecruitementAlertsNotifiedCandidates');
  },
};
