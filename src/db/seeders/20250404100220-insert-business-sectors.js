'use strict';
const uuid = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('BusinessSectors', [
      {
        id: uuid.v4(),
        name: 'Logistique et approvisionnement',
        value: 'la',
        prefixes: "la,l'",
      },
      {
        id: uuid.v4(),
        name: 'Assistanat et administratif',
        value: 'aa',
        prefixes: "l',l'",
      },
      {
        id: uuid.v4(),
        name: 'Bâtiment',
        value: 'bat',
        prefixes: 'le',
      },
      {
        id: uuid.v4(),
        name: 'Restauration et hôtellerie',
        value: 'rh',
        prefixes: "la,l'",
      },
      {
        id: uuid.v4(),
        name: 'Commerce et distribution',
        value: 'cd',
        prefixes: 'le,la',
      },
      {
        id: uuid.v4(),
        name: 'Aide et service à la personne',
        value: 'asp',
        prefixes: "l',le",
      },
      {
        id: uuid.v4(),
        name: 'Propreté',
        value: 'pr',
        prefixes: 'la',
      },
      {
        id: uuid.v4(),
        name: 'Maintenance et industrie',
        value: 'mi',
        prefixes: "la,l'",
      },
      {
        id: uuid.v4(),
        name: 'Artisanat',
        value: 'art',
        prefixes: "l'",
      },
      {
        id: uuid.v4(),
        name: 'Transport',
        value: 'tra',
        prefixes: 'le',
      },
      {
        id: uuid.v4(),
        name: 'Informatique et digital',
        value: 'id',
        prefixes: "l',le",
      },
      {
        id: uuid.v4(),
        name: 'Sécurité',
        value: 'sec',
        prefixes: 'la',
      },
      {
        id: uuid.v4(),
        name: 'Communication et marketing',
        value: 'cm',
        prefixes: 'la,le',
      },
      {
        id: uuid.v4(),
        name: 'Culture et art',
        value: 'ca',
        prefixes: "la,l'",
      },
      {
        id: uuid.v4(),
        name: 'Agriculture et espaces verts',
        value: 'aev',
        prefixes: "l',les",
      },
      {
        id: uuid.v4(),
        name: 'Social et associatif',
        value: 'sa',
        prefixes: "le,l'",
      },
      {
        id: uuid.v4(),
        name: 'Direction financière, juridique et ressources humaines',
        value: 'fjr',
        prefixes: 'la,les',
      },
      {
        id: uuid.v4(),
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
