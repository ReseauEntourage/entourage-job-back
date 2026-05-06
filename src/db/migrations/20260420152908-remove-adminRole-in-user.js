'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'adminRole');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'adminRole', {
      allowNull: true,
      type: Sequelize.STRING,
    });
  },
};
