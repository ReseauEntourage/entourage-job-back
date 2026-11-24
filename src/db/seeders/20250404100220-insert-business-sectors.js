'use strict';
const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('BusinessSectors', [
      {
        id: randomUUID(),
        name: 'Logistique et approvisionnement',
        value: 'la',
        prefixes: "la,l'",
      },
      {
        id: randomUUID(),
        name: 'Assistanat et administratif',
        value: 'aa',
        prefixes: "l',l'",
      },
      {
        id: randomUUID(),
        name: 'Bâtiment',
        value: 'bat',
        prefixes: 'le',
      },
      {
        id: randomUUID(),
        name: 'Restauration et hôtellerie',
        value: 'rh',
        prefixes: "la,l'",
      },
      {
        id: randomUUID(),
        name: 'Commerce et distribution',
        value: 'cd',
        prefixes: 'le,la',
      },
      {
        id: randomUUID(),
        name: 'Aide et service à la personne',
        value: 'asp',
        prefixes: "l',le",
      },
      {
        id: randomUUID(),
        name: 'Propreté',
        value: 'pr',
        prefixes: 'la',
      },
      {
        id: randomUUID(),
        name: 'Maintenance et industrie',
        value: 'mi',
        prefixes: "la,l'",
      },
      {
        id: randomUUID(),
        name: 'Artisanat',
        value: 'art',
        prefixes: "l'",
      },
      {
        id: randomUUID(),
        name: 'Transport',
        value: 'tra',
        prefixes: 'le',
      },
      {
        id: randomUUID(),
        name: 'Informatique et digital',
        value: 'id',
        prefixes: "l',le",
      },
      {
        id: randomUUID(),
        name: 'Sécurité',
        value: 'sec',
        prefixes: 'la',
      },
      {
        id: randomUUID(),
        name: 'Communication et marketing',
        value: 'cm',
        prefixes: 'la,le',
      },
      {
        id: randomUUID(),
        name: 'Culture et art',
        value: 'ca',
        prefixes: "la,l'",
      },
      {
        id: randomUUID(),
        name: 'Agriculture et espaces verts',
        value: 'aev',
        prefixes: "l',les",
      },
      {
        id: randomUUID(),
        name: 'Social et associatif',
        value: 'sa',
        prefixes: "le,l'",
      },
      {
        id: randomUUID(),
        name: 'Direction financière, juridique et ressources humaines',
        value: 'fjr',
        prefixes: 'la,les',
      },
      {
        id: randomUUID(),
        name: 'Santé et médical',
        value: 'sm',
        prefixes: 'la,le',
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('BusinessSectors', null, {});
  },
};
