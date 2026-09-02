'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('UserProfiles', 'hasExternalCv');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('UserProfiles', 'hasExternalCv', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
};
