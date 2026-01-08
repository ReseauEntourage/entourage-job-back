'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add onboardingStatus column to Users table
    await queryInterface.addColumn('Users', 'onboardingStatus', {
      type: Sequelize.ENUM('not_started', 'in_progress', 'completed'),
      allowNull: false,
      defaultValue: 'not_started',
    });

    // Add onboardingCompletedAt column to Users table
    await queryInterface.addColumn('Users', 'onboardingCompletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Optionally, you can add code here to initialize the onboardingStatus for existing users
    await queryInterface.sequelize.query(
      `
        UPDATE "Users" u
        SET "onboardingStatus" = 'completed', "onboardingCompletedAt" = NOW()
        WHERE EXISTS (
          SELECT 1
          FROM "ReadDocuments" rd
          WHERE rd."UserId" = u."id"
            AND rd."documentName" = 'CharteEthique'
        );
      `
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove onboardingStatus column from Users table
    await queryInterface.removeColumn('Users', 'onboardingStatus');

    // Remove onboardingCompletedAt column from Users table
    await queryInterface.removeColumn('Users', 'onboardingCompletedAt');
  },
};
