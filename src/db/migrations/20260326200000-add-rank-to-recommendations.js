'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('UserProfileRecommendations', 'rank', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Composite index for efficient cursor-based pagination per user
    await queryInterface.addIndex('UserProfileRecommendations', ['UserId', 'rank'], {
      name: 'user_profile_recommendations_user_id_rank_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'UserProfileRecommendations',
      'user_profile_recommendations_user_id_rank_idx'
    );
    await queryInterface.removeColumn('UserProfileRecommendations', 'rank');
  },
};
