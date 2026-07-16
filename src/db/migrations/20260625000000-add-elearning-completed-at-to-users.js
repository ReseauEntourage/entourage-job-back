'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'elearningCompletedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.sequelize.query(`
      UPDATE "Users"
      SET "elearningCompletedAt" = "onboardingCompletedAt"
      WHERE "onboardingStatus" = 'completed'
        AND "elearningCompletedAt" IS NULL
        AND "onboardingCompletedAt" IS NOT NULL
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Users', 'elearningCompletedAt');
  },
};
