module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('User_Profiles_Recommendations', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      UserProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'User_Profiles',
          key: 'id',
        },
      },
      RecommendedUserProfileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'User_Profiles',
          key: 'id',
        },
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deletedAt: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addColumn('User_Profiles', 'lastRecommendationDate', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('User_Profiles_Recommendations');
    await queryInterface.removeColumn(
      'User_Profiles',
      'lastRecommendationDate'
    );
  },
};
