'use strict';

const uuid = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Nudges', [
      {
        id: uuid.v4(),
        value: 'discovery',
        nameRequest: "Découvrir un métier qui m'attire",
        nameOffer: 'Faire découvrir mon métier',
        order: 4,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Nudges', { value: 'discovery' }, {});
  },
};
