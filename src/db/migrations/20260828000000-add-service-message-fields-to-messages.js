'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Messages', 'serviceMessageKind', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Messages', 'metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Messages', 'metadata');
    await queryInterface.removeColumn('Messages', 'serviceMessageKind');
  },
};
