'use strict';

const uuid = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Contracts', [
      { id: uuid.v4(), name: 'Alternance' },
      { id: uuid.v4(), name: 'Contrat à durée indéterminée (CDI)' },
      { id: uuid.v4(), name: 'Contrat à durée déterminée (CDD)' },
      { id: uuid.v4(), name: "Contrat d'insertion" },
      { id: uuid.v4(), name: 'Intérim' },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Contracts', null, {});
  },
};
