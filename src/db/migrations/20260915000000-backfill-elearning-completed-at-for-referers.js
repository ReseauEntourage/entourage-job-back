'use strict';

/**
 * Data-only backfill. Referer (Prescripteur) accounts have no eLearning
 * units assigned, so the messaging contact gate
 * (MessagingService.assertElearningCompletedForNewConversation) must not
 * block them — see users-creation.controller.ts, which now sets
 * elearningCompletedAt at account creation for that role. This backfills
 * referer accounts created before that fix, which are otherwise unable to
 * start a new conversation.
 */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Users"
      SET "elearningCompletedAt" = NOW()
      WHERE role = 'Prescripteur'
        AND "elearningCompletedAt" IS NULL
        AND "deletedAt" IS NULL
    `);
  },

  // Not reversible: the affected rows can no longer be distinguished from
  // referers that legitimately had elearningCompletedAt set some other way.
  down: async () => {},
};
