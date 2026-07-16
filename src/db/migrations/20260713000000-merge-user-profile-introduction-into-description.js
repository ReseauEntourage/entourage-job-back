'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "UserProfiles"
      SET description = introduction
      WHERE (description IS NULL OR description = '')
        AND introduction IS NOT NULL
    `);
  },

  down: async () => {
    // Data merge is not reversible: once introduction has been copied into
    // description, there is no way to tell which rows originally had a
    // distinct description value.
  },
};
