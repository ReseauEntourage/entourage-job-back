'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'sfContactId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Users', 'sfContactId');
  },
};
