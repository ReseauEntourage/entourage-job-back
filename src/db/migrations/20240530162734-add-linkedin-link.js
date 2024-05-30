'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('User_Profiles', 'linkedinLink', {
      allowNull: true,
      type: Sequelize.STRING,
      defaultValue: NULL,
    });
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('User_Profiles', 'linkedinLink');
  },
};
