'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Nudges"
      SET "nameRequest" = 'Réaliser un CV et des lettres de motivation'
      WHERE value = 'cv' AND "nameRequest" = 'Réaliser son CV et ses lettres de motivation'
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Nudges"
      SET "nameRequest" = 'Réaliser son CV et ses lettres de motivation'
      WHERE value = 'cv' AND "nameRequest" = 'Réaliser un CV et des lettres de motivation'
    `);
  },
};
