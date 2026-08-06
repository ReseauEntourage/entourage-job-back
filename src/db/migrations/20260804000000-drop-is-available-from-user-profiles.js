'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn('UserProfiles', 'isAvailable');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('UserProfiles', 'isAvailable', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },
};
