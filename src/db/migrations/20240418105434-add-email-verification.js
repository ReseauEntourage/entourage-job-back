'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Users', 'isEmailVerified', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('Users', 'isEmailVerified');
  },
};
