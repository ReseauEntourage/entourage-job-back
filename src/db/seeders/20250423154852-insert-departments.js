'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Departments', [
      {
        id: randomUUID(),
        value: '01',
        name: 'Ain',
      },
      {
        id: randomUUID(),
        value: '02',
        name: 'Aisne',
      },
      {
        id: randomUUID(),
        value: '03',
        name: 'Allier',
      },
      {
        id: randomUUID(),
        value: '04',
        name: 'Alpes-de-Haute-Provence',
      },
      {
        id: randomUUID(),
        value: '05',
        name: 'Hautes-Alpes',
      },
      {
        id: randomUUID(),
        value: '06',
        name: 'Alpes-Maritimes',
      },
      {
        id: randomUUID(),
        value: '07',
        name: 'Ardèche',
      },
      {
        id: randomUUID(),
        value: '08',
        name: 'Ardennes',
      },
      {
        id: randomUUID(),
        value: '09',
        name: 'Ariège',
      },
      {
        id: randomUUID(),
        value: '10',
        name: 'Aube',
      },
      {
        id: randomUUID(),
        value: '11',
        name: 'Aude',
      },
      {
        id: randomUUID(),
        value: '12',
        name: 'Aveyron',
      },
      {
        id: randomUUID(),
        value: '13',
        name: 'Bouches-du-Rhône',
      },
      {
        id: randomUUID(),
        value: '14',
        name: 'Calvados',
      },
      {
        id: randomUUID(),
        value: '15',
        name: 'Cantal',
      },
      {
        id: randomUUID(),
        value: '16',
        name: 'Charente',
      },
      {
        id: randomUUID(),
        value: '17',
        name: 'Charente-Maritime',
      },
      {
        id: randomUUID(),
        value: '18',
        name: 'Cher',
      },
      {
        id: randomUUID(),
        value: '19',
        name: 'Corrèze',
      },
      {
        id: randomUUID(),
        value: '21',
        name: "Côte-d'Or",
      },
      {
        id: randomUUID(),
        value: '22',
        name: "Côtes-d'Armor",
      },
      {
        id: randomUUID(),
        value: '23',
        name: 'Creuse',
      },
      {
        id: randomUUID(),
        value: '24',
        name: 'Dordogne',
      },
      {
        id: randomUUID(),
        value: '25',
        name: 'Doubs',
      },
      {
        id: randomUUID(),
        value: '26',
        name: 'Drôme',
      },
      {
        id: randomUUID(),
        value: '27',
        name: 'Eure',
      },
      {
        id: randomUUID(),
        value: '28',
        name: 'Eure-et-Loir',
      },
      {
        id: randomUUID(),
        value: '29',
        name: 'Finistère',
      },
      {
        id: randomUUID(),
        value: '2A',
        name: 'Corse-du-Sud',
      },
      {
        id: randomUUID(),
        value: '2B',
        name: 'Haute-Corse',
      },
      {
        id: randomUUID(),
        value: '30',
        name: 'Gard',
      },
      {
        id: randomUUID(),
        value: '31',
        name: 'Haute-Garonne',
      },
      {
        id: randomUUID(),
        value: '32',
        name: 'Gers',
      },
      {
        id: randomUUID(),
        value: '33',
        name: 'Gironde',
      },
      {
        id: randomUUID(),
        value: '34',
        name: 'Hérault',
      },
      {
        id: randomUUID(),
        value: '35',
        name: 'Ille-et-Vilaine',
      },
      {
        id: randomUUID(),
        value: '36',
        name: 'Indre',
      },
      {
        id: randomUUID(),
        value: '37',
        name: 'Indre-et-Loire',
      },
      {
        id: randomUUID(),
        value: '38',
        name: 'Isère',
      },
      {
        id: randomUUID(),
        value: '39',
        name: 'Jura',
      },
      {
        id: randomUUID(),
        value: '40',
        name: 'Landes',
      },
      {
        id: randomUUID(),
        value: '41',
        name: 'Loir-et-Cher',
      },
      {
        id: randomUUID(),
        value: '42',
        name: 'Loire',
      },
      {
        id: randomUUID(),
        value: '43',
        name: 'Haute-Loire',
      },
      {
        id: randomUUID(),
        value: '44',
        name: 'Loire-Atlantique',
      },
      {
        id: randomUUID(),
        value: '45',
        name: 'Loiret',
      },
      {
        id: randomUUID(),
        value: '46',
        name: 'Lot',
      },
      {
        id: randomUUID(),
        value: '47',
        name: 'Lot-et-Garonne',
      },
      {
        id: randomUUID(),
        value: '48',
        name: 'Lozère',
      },
      {
        id: randomUUID(),
        value: '49',
        name: 'Maine-et-Loire',
      },
      {
        id: randomUUID(),
        value: '50',
        name: 'Manche',
      },
      {
        id: randomUUID(),
        value: '51',
        name: 'Marne',
      },
      {
        id: randomUUID(),
        value: '52',
        name: 'Haute-Marne',
      },
      {
        id: randomUUID(),
        value: '53',
        name: 'Mayenne',
      },
      {
        id: randomUUID(),
        value: '54',
        name: 'Meurthe-et-Moselle',
      },
      {
        id: randomUUID(),
        value: '55',
        name: 'Meuse',
      },
      {
        id: randomUUID(),
        value: '56',
        name: 'Morbihan',
      },
      {
        id: randomUUID(),
        value: '57',
        name: 'Moselle',
      },
      {
        id: randomUUID(),
        value: '58',
        name: 'Nièvre',
      },
      {
        id: randomUUID(),
        value: '59',
        name: 'Nord',
      },
      {
        id: randomUUID(),
        value: '60',
        name: 'Oise',
      },
      {
        id: randomUUID(),
        value: '61',
        name: 'Orne',
      },
      {
        id: randomUUID(),
        value: '62',
        name: 'Pas-de-Calais',
      },
      {
        id: randomUUID(),
        value: '63',
        name: 'Puy-de-Dôme',
      },
      {
        id: randomUUID(),
        value: '64',
        name: 'Pyrénées-Atlantiques',
      },
      {
        id: randomUUID(),
        value: '65',
        name: 'Hautes-Pyrénées',
      },
      {
        id: randomUUID(),
        value: '66',
        name: 'Pyrénées-Orientales',
      },
      {
        id: randomUUID(),
        value: '67',
        name: 'Bas-Rhin',
      },
      {
        id: randomUUID(),
        value: '68',
        name: 'Haut-Rhin',
      },
      {
        id: randomUUID(),
        value: '69',
        name: 'Rhône',
      },
      {
        id: randomUUID(),
        value: '70',
        name: 'Haute-Saône',
      },
      {
        id: randomUUID(),
        value: '71',
        name: 'Saône-et-Loire',
      },
      {
        id: randomUUID(),
        value: '72',
        name: 'Sarthe',
      },
      {
        id: randomUUID(),
        value: '73',
        name: 'Savoie',
      },
      {
        id: randomUUID(),
        value: '74',
        name: 'Haute-Savoie',
      },
      {
        id: randomUUID(),
        value: '75',
        name: 'Paris',
      },
      {
        id: randomUUID(),
        value: '76',
        name: 'Seine-Maritime',
      },
      {
        id: randomUUID(),
        value: '77',
        name: 'Seine-et-Marne',
      },
      {
        id: randomUUID(),
        value: '78',
        name: 'Yvelines',
      },
      {
        id: randomUUID(),
        value: '79',
        name: 'Deux-Sèvres',
      },
      {
        id: randomUUID(),
        value: '80',
        name: 'Somme',
      },
      {
        id: randomUUID(),
        value: '81',
        name: 'Tarn',
      },
      {
        id: randomUUID(),
        value: '82',
        name: 'Tarn-et-Garonne',
      },
      {
        id: randomUUID(),
        value: '83',
        name: 'Var',
      },
      {
        id: randomUUID(),
        value: '84',
        name: 'Vaucluse',
      },
      {
        id: randomUUID(),
        value: '85',
        name: 'Vendée',
      },
      {
        id: randomUUID(),
        value: '86',
        name: 'Vienne',
      },
      {
        id: randomUUID(),
        value: '87',
        name: 'Haute-Vienne',
      },
      {
        id: randomUUID(),
        value: '88',
        name: 'Vosges',
      },
      {
        id: randomUUID(),
        value: '89',
        name: 'Yonne',
      },
      {
        id: randomUUID(),
        value: '90',
        name: 'Territoire de Belfort',
      },
      {
        id: randomUUID(),
        value: '91',
        name: 'Essonne',
      },
      {
        id: randomUUID(),
        value: '92',
        name: 'Hauts-de-Seine',
      },
      {
        id: randomUUID(),
        value: '93',
        name: 'Seine-Saint-Denis',
      },
      {
        id: randomUUID(),
        value: '94',
        name: 'Val-de-Marne',
      },
      {
        id: randomUUID(),
        value: '95',
        name: "Val-d'Oise",
      },
      {
        id: randomUUID(),
        value: '971',
        name: 'Guadeloupe',
      },
      {
        id: randomUUID(),
        value: '972',
        name: 'Martinique',
      },
      {
        id: randomUUID(),
        value: '973',
        name: 'Guyane',
      },
      {
        id: randomUUID(),
        value: '974',
        name: 'La Réunion',
      },
      {
        id: randomUUID(),
        value: '976',
        name: 'Mayotte',
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Departments', null, {});
  },
};
