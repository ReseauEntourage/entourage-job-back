'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface) => {
    return queryInterface.bulkDelete('UserFeatureFlags', {
      featureKey: 'messaging_ai_assistant',
    });
  },
  // Not reversible: which users had the flag enabled is not recorded anywhere
  // else, and the flag gated nothing in practice before this change.
  down: () => Promise.resolve(),
};
