'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // `Passions` was dropped by 20250829145254-remove-deprecated-cv-tables but
    // recreated empty at every startup by the automatic model synchronization
    await queryInterface.dropTable('Passions');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('Passions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING,
      },
      name: { allowNull: false, type: Sequelize.STRING },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
};
