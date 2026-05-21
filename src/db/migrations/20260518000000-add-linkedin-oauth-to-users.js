'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'linkedinId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'linkedinAccessToken', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'linkedinRefreshToken', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'linkedinTokenExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Users', 'linkedinTokenExpiresAt');
    await queryInterface.removeColumn('Users', 'linkedinRefreshToken');
    await queryInterface.removeColumn('Users', 'linkedinAccessToken');
    await queryInterface.removeColumn('Users', 'linkedinId');
  },
};
