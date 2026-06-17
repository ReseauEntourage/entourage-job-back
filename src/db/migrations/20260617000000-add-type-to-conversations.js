'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Conversations', 'type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'direct',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Conversations', 'type');
  },
};
