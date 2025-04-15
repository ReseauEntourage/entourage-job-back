'use strict';

const uuid = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Nudges', [
      {
        id: '333f4859-5819-4853-b305-772fb8e7cc23',
        value: 'tips',
        nameRequest: 'Demander des conseils aux membres de la communauté',
        nameOffer: 'Donner des conseils aux membres de la communauté',
        order: 0,
      },
      {
        id: 'd036aa7f-0c42-41ec-9bc4-d07b1715d3ec',
        value: 'interview',
        nameRequest: 'Se préparer aux entretiens d’embauche',
        nameOffer: 'Aider à préparer les entretiens d’embauche',
        order: 1,
      },
      {
        id: 'be74e4ef-9235-4dee-91a9-442108b8dda4',
        value: 'cv',
        nameRequest: 'Réaliser son CV et ses lettres de motivation',
        nameOffer: 'Aider à réaliser un CV et une lettre de motivation',
        order: 2,
      },
      {
        id: '04c600e9-0996-46fc-b295-22d1c0b981de',
        value: 'network',
        nameRequest: 'Faire grandir son réseau professionnel',
        nameOffer: 'Partager mon réseau professionnel',
        order: 3,
      },
      {
        id: 'f0c6c2e7-7176-41d7-bfc7-2e4d5a543f15',
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
