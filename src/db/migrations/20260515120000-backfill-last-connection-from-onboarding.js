'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE "Users"
      SET "lastConnection" = "onboardingCompletedAt"
      WHERE "lastConnection" IS NULL
        AND "onboardingCompletedAt" IS NOT NULL
    `);
  },

  async down() {
    // Irreversible: cannot distinguish backfilled values from real connections
  },
};
