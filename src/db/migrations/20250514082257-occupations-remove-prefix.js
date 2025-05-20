'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Occupations', 'prefix');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Occupations', 'prefix', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'comme',
    });
  },
};
