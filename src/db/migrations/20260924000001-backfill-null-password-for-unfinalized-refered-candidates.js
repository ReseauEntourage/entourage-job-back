'use strict';

/**
 * Data-only backfill. Refered candidates used to be created with a random
 * password nobody knew, only because `Users.password` was NOT NULL (lifted by
 * 20260924000000-allow-null-password-on-users). This clears it for refered
 * candidates who have not verified their email, so that they are back in the
 * same state as newly refered ones and can finalize their account through a
 * new activation link.
 *
 * This includes candidates who set a password through "forgot password"
 * without ever verifying their email: that password could not sign them in
 * (login rejects unverified emails), and finalizing now also notifies their
 * referer, which the reset path never did.
 *
 * Must only reach production together with, or after, the
 * `send-finalize-refered-user` endpoint and the front page offering it —
 * otherwise these candidates lose the "unverified email" login message
 * without having gained the way out.
 */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Users"
      SET "password" = NULL,
          "salt" = NULL
      WHERE "refererId" IS NOT NULL
        AND "isEmailVerified" = false
    `);
  },

  // Not reversible: the cleared passwords were either never communicated to
  // anyone or unusable for signing in, so there is nothing worth restoring.
  down: async () => {},
};
