'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Contracts', [
      { id: randomUUID(), name: 'Alternance' },
      { id: randomUUID(), name: 'Contrat à durée indéterminée (CDI)' },
      { id: randomUUID(), name: 'Contrat à durée déterminée (CDD)' },
      { id: randomUUID(), name: "Contrat d'insertion" },
      { id: randomUUID(), name: 'Intérim' },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Contracts', null, {});
  },
};
