'use strict';

// Backfill date deliberately far in the past, outside the daily cron's
// "yesterday" window, so the deploy doesn't trigger a mass send of the
// new unavailability notification email (see design.md, Risks / Trade-offs).
const BACKFILL_UNAVAILABLE_AT = '2026-08-01T00:00:00.000Z';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "UserProfiles"
      SET "unavailableAt" = :backfillDate
      WHERE "isAvailable" = false
    `, {
      replacements: { backfillDate: BACKFILL_UNAVAILABLE_AT },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "UserProfiles"
      SET "unavailableAt" = NULL
      WHERE "unavailableAt" = :backfillDate
    `, {
      replacements: { backfillDate: BACKFILL_UNAVAILABLE_AT },
    });
  },
};
