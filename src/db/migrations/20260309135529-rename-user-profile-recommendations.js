'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'User_Profile_Recommendations',
      'UserProfileRecommendations'
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameTable(
      'UserProfileRecommendations',
      'User_Profile_Recommendations'
    );
  },
};
