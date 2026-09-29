'use strict';

/**
 * Allows `Users.password` and `Users.salt` to be null, so that an account for
 * which no password has ever been chosen is explicit in the database. Refered
 * candidates are created in that state until they finalize their account on
 * `/finaliser-compte-oriente`; they previously got an unknown random password
 * only because these columns were NOT NULL.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Users', 'password', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn('Users', 'salt', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  // Rows without a password must be given one before NOT NULL can be restored.
  // A random md5 hex string can never match `validatePassword`'s 1024-char
  // pbkdf2 output, so those accounts stay impossible to sign in to by password,
  // exactly like the random password they used to be created with.
  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      UPDATE "Users"
      SET "password" = md5(random()::text),
          "salt" = md5(random()::text)
      WHERE "password" IS NULL OR "salt" IS NULL
    `);
    await queryInterface.changeColumn('Users', 'password', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
    await queryInterface.changeColumn('Users', 'salt', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
