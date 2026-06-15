'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'otpCode', {
      type: Sequelize.STRING(64),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Users', 'otpExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('Users', 'otpAttempts', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Users', 'otpCode');
    await queryInterface.removeColumn('Users', 'otpExpiresAt');
    await queryInterface.removeColumn('Users', 'otpAttempts');
  },
};
