'use strict';

const uuid = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Nudges', [
      {
        id: uuid.v4(),
        value: 'tips',
        nameRequest: 'Demander des conseils aux membres de la communauté',
        nameOffer: 'Donner des conseils aux membres de la communauté',
        order: 0,
      },
      {
        id: uuid.v4(),
        value: 'interview',
        nameRequest: 'Se préparer aux entretiens d’embauche',
        nameOffer: 'Aider à préparer les entretiens d’embauche',
        order: 1,
      },
      {
        id: uuid.v4(),
        value: 'cv',
        nameRequest: 'Réaliser son CV et ses lettres de motivation',
        nameOffer: 'Aider à réaliser un CV et une lettre de motivation',
        order: 2,
      },
      {
        id: uuid.v4(),
        value: 'network',
        nameRequest: 'Faire grandir son réseau professionnel',
        nameOffer: 'Partager mon réseau professionnel',
        order: 3,
      },
      {
        id: uuid.v4(),
        value: 'event',
        nameRequest:
          'Se rencontrer et échanger avec les membres de la communauté',
        nameOffer:
          'Se rencontrer lors d’événements avec les membres de la communauté',
        order: 4,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Nudges', null, {});
  },
};
