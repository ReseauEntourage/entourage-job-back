'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('UserProfiles', 'optInRecommendations', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: true, // Default value set to true, users will receive recommendations by default
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('UserProfiles', 'optInRecommendations');
  },
};
