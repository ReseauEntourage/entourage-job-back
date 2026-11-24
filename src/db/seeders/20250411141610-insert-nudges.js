'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Nudges', [
      {
        id: randomUUID(),
        value: 'tips',
        nameRequest: 'Obtenir des conseils',
        nameOffer: 'Donner des conseils',
        order: 0,
      },
      {
        id: randomUUID(),
        value: 'interview',
        nameRequest: 'Se préparer aux entretiens d’embauche',
        nameOffer: 'Aider à préparer les entretiens d’embauche',
        order: 1,
      },
      {
        id: randomUUID(),
        value: 'cv',
        nameRequest: 'Réaliser un CV et des lettres de motivation',
        nameOffer: 'Aider à réaliser un CV et une lettre de motivation',
        order: 2,
      },
      {
        id: randomUUID(),
        value: 'network',
        nameRequest: 'Faire grandir son réseau professionnel',
        nameOffer: 'Partager mon réseau professionnel',
        order: 3,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Nudges', null, {});
  },
};
