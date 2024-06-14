'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('User_Profiles', 'linkedinUrl', {
      allowNull: true,
      type: Sequelize.STRING,
      defaultValue: null,
    });
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('User_Profiles', 'linkedinUrl');
  },
};
