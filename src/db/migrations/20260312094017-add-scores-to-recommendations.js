'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'UserProfileRecommendations',
      'profileScore',
      {
        type: Sequelize.FLOAT,
        allowNull: true,
      }
    );
    await queryInterface.addColumn('UserProfileRecommendations', 'needsScore', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
    await queryInterface.addColumn(
      'UserProfileRecommendations',
      'activityScore',
      {
        type: Sequelize.FLOAT,
        allowNull: true,
      }
    );
    await queryInterface.addColumn(
      'UserProfileRecommendations',
      'locationCompatibilityScore',
      {
        type: Sequelize.FLOAT,
        allowNull: true,
      }
    );
    await queryInterface.addColumn('UserProfileRecommendations', 'finalScore', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      'UserProfileRecommendations',
      'finalScore'
    );
    await queryInterface.removeColumn(
      'UserProfileRecommendations',
      'locationCompatibilityScore'
    );
    await queryInterface.removeColumn(
      'UserProfileRecommendations',
      'activityScore'
    );
    await queryInterface.removeColumn(
      'UserProfileRecommendations',
      'needsScore'
    );
    await queryInterface.removeColumn(
      'UserProfileRecommendations',
      'profileScore'
    );
  },
};
