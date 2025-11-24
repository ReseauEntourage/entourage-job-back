'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Skills', 'createdAt', {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
    await queryInterface.addColumn('Skills', 'updatedAt', {
      allowNull: false,
      type: Sequelize.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Skills', 'createdAt');
    await queryInterface.removeColumn('Skills', 'updatedAt');
  },
};
