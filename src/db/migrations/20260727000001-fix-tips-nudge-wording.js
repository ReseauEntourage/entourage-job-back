'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Nudges"
      SET "nameRequest" = 'Obtenir des conseils'
      WHERE value = 'tips' AND "nameRequest" = 'Demander des conseils aux membres de la communauté'
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Nudges"
      SET "nameOffer" = 'Donner des conseils'
      WHERE value = 'tips' AND "nameOffer" = 'Donner des conseils aux membres de la communauté'
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Nudges"
      SET "nameRequest" = 'Demander des conseils aux membres de la communauté'
      WHERE value = 'tips' AND "nameRequest" = 'Obtenir des conseils'
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Nudges"
      SET "nameOffer" = 'Donner des conseils aux membres de la communauté'
      WHERE value = 'tips' AND "nameOffer" = 'Donner des conseils'
    `);
  },
};
