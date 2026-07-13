'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn('UserProfiles', 'introduction');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('UserProfiles', 'introduction', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
  },
};
