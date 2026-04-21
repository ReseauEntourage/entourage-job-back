'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'address');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'address', {
      allowNull: true,
      type: Sequelize.STRING,
    });
  },
};
