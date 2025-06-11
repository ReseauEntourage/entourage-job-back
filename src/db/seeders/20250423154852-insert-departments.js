'use strict';

const uuid = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Departments', [
      {
        id: uuid.v4(),
        value: '01',
        name: 'Ain',
      },
      {
        id: uuid.v4(),
        value: '02',
        name: 'Aisne',
      },
      {
        id: uuid.v4(),
        value: '03',
        name: 'Allier',
      },
      {
        id: uuid.v4(),
        value: '04',
        name: 'Alpes-de-Haute-Provence',
      },
      {
        id: uuid.v4(),
        value: '05',
        name: 'Hautes-Alpes',
      },
      {
        id: uuid.v4(),
        value: '06',
        name: 'Alpes-Maritimes',
      },
      {
        id: uuid.v4(),
        value: '07',
        name: 'Ardèche',
      },
      {
        id: uuid.v4(),
        value: '08',
        name: 'Ardennes',
      },
      {
        id: uuid.v4(),
        value: '09',
        name: 'Ariège',
      },
      {
        id: uuid.v4(),
        value: '10',
        name: 'Aube',
      },
      {
        id: uuid.v4(),
        value: '11',
        name: 'Aude',
      },
      {
        id: uuid.v4(),
        value: '12',
        name: 'Aveyron',
      },
      {
        id: uuid.v4(),
        value: '13',
        name: 'Bouches-du-Rhône',
      },
      {
        id: uuid.v4(),
        value: '14',
        name: 'Calvados',
      },
      {
        id: uuid.v4(),
        value: '15',
        name: 'Cantal',
      },
      {
        id: uuid.v4(),
        value: '16',
        name: 'Charente',
      },
      {
        id: uuid.v4(),
        value: '17',
        name: 'Charente-Maritime',
      },
      {
        id: uuid.v4(),
        value: '18',
        name: 'Cher',
      },
      {
        id: uuid.v4(),
        value: '19',
        name: 'Corrèze',
      },
      {
        id: uuid.v4(),
        value: '21',
        name: "Côte-d'Or",
      },
      {
        id: uuid.v4(),
        value: '22',
        name: "Côtes-d'Armor",
      },
      {
        id: uuid.v4(),
        value: '23',
        name: 'Creuse',
      },
      {
        id: uuid.v4(),
        value: '24',
        name: 'Dordogne',
      },
      {
        id: uuid.v4(),
        value: '25',
        name: 'Doubs',
      },
      {
        id: uuid.v4(),
        value: '26',
        name: 'Drôme',
      },
      {
        id: uuid.v4(),
        value: '27',
        name: 'Eure',
      },
      {
        id: uuid.v4(),
        value: '28',
        name: 'Eure-et-Loir',
      },
      {
        id: uuid.v4(),
        value: '29',
        name: 'Finistère',
      },
      {
        id: uuid.v4(),
        value: '2A',
        name: 'Corse-du-Sud',
      },
      {
        id: uuid.v4(),
        value: '2B',
        name: 'Haute-Corse',
      },
      {
        id: uuid.v4(),
        value: '30',
        name: 'Gard',
      },
      {
        id: uuid.v4(),
        value: '31',
        name: 'Haute-Garonne',
      },
      {
        id: uuid.v4(),
        value: '32',
        name: 'Gers',
      },
      {
        id: uuid.v4(),
        value: '33',
        name: 'Gironde',
      },
      {
        id: uuid.v4(),
        value: '34',
        name: 'Hérault',
      },
      {
        id: uuid.v4(),
        value: '35',
        name: 'Ille-et-Vilaine',
      },
      {
        id: uuid.v4(),
        value: '36',
        name: 'Indre',
      },
      {
        id: uuid.v4(),
        value: '37',
        name: 'Indre-et-Loire',
      },
      {
        id: uuid.v4(),
        value: '38',
        name: 'Isère',
      },
      {
        id: uuid.v4(),
        value: '39',
        name: 'Jura',
      },
      {
        id: uuid.v4(),
        value: '40',
        name: 'Landes',
      },
      {
        id: uuid.v4(),
        value: '41',
        name: 'Loir-et-Cher',
      },
      {
        id: uuid.v4(),
        value: '42',
        name: 'Loire',
      },
      {
        id: uuid.v4(),
        value: '43',
        name: 'Haute-Loire',
      },
      {
        id: uuid.v4(),
        value: '44',
        name: 'Loire-Atlantique',
      },
      {
        id: uuid.v4(),
        value: '45',
        name: 'Loiret',
      },
      {
        id: uuid.v4(),
        value: '46',
        name: 'Lot',
      },
      {
        id: uuid.v4(),
        value: '47',
        name: 'Lot-et-Garonne',
      },
      {
        id: uuid.v4(),
        value: '48',
        name: 'Lozère',
      },
      {
        id: uuid.v4(),
        value: '49',
        name: 'Maine-et-Loire',
      },
      {
        id: uuid.v4(),
        value: '50',
        name: 'Manche',
      },
      {
        id: uuid.v4(),
        value: '51',
        name: 'Marne',
      },
      {
        id: uuid.v4(),
        value: '52',
        name: 'Haute-Marne',
      },
      {
        id: uuid.v4(),
        value: '53',
        name: 'Mayenne',
      },
      {
        id: uuid.v4(),
        value: '54',
        name: 'Meurthe-et-Moselle',
      },
      {
        id: uuid.v4(),
        value: '55',
        name: 'Meuse',
      },
      {
        id: uuid.v4(),
        value: '56',
        name: 'Morbihan',
      },
      {
        id: uuid.v4(),
        value: '57',
        name: 'Moselle',
      },
      {
        id: uuid.v4(),
        value: '58',
        name: 'Nièvre',
      },
      {
        id: uuid.v4(),
        value: '59',
        name: 'Nord',
      },
      {
        id: uuid.v4(),
        value: '60',
        name: 'Oise',
      },
      {
        id: uuid.v4(),
        value: '61',
        name: 'Orne',
      },
      {
        id: uuid.v4(),
        value: '62',
        name: 'Pas-de-Calais',
      },
      {
        id: uuid.v4(),
        value: '63',
        name: 'Puy-de-Dôme',
      },
      {
        id: uuid.v4(),
        value: '64',
        name: 'Pyrénées-Atlantiques',
      },
      {
        id: uuid.v4(),
        value: '65',
        name: 'Hautes-Pyrénées',
      },
      {
        id: uuid.v4(),
        value: '66',
        name: 'Pyrénées-Orientales',
      },
      {
        id: uuid.v4(),
        value: '67',
        name: 'Bas-Rhin',
      },
      {
        id: uuid.v4(),
        value: '68',
        name: 'Haut-Rhin',
      },
      {
        id: uuid.v4(),
        value: '69',
        name: 'Rhône',
      },
      {
        id: uuid.v4(),
        value: '70',
        name: 'Haute-Saône',
      },
      {
        id: uuid.v4(),
        value: '71',
        name: 'Saône-et-Loire',
      },
      {
        id: uuid.v4(),
        value: '72',
        name: 'Sarthe',
      },
      {
        id: uuid.v4(),
        value: '73',
        name: 'Savoie',
      },
      {
        id: uuid.v4(),
        value: '74',
        name: 'Haute-Savoie',
      },
      {
        id: uuid.v4(),
        value: '75',
        name: 'Paris',
      },
      {
        id: uuid.v4(),
        value: '76',
        name: 'Seine-Maritime',
      },
      {
        id: uuid.v4(),
        value: '77',
        name: 'Seine-et-Marne',
      },
      {
        id: uuid.v4(),
        value: '78',
        name: 'Yvelines',
      },
      {
        id: uuid.v4(),
        value: '79',
        name: 'Deux-Sèvres',
      },
      {
        id: uuid.v4(),
        value: '80',
        name: 'Somme',
      },
      {
        id: uuid.v4(),
        value: '81',
        name: 'Tarn',
      },
      {
        id: uuid.v4(),
        value: '82',
        name: 'Tarn-et-Garonne',
      },
      {
        id: uuid.v4(),
        value: '83',
        name: 'Var',
      },
      {
        id: uuid.v4(),
        value: '84',
        name: 'Vaucluse',
      },
      {
        id: uuid.v4(),
        value: '85',
        name: 'Vendée',
      },
      {
        id: uuid.v4(),
        value: '86',
        name: 'Vienne',
      },
      {
        id: uuid.v4(),
        value: '87',
        name: 'Haute-Vienne',
      },
      {
        id: uuid.v4(),
        value: '88',
        name: 'Vosges',
      },
      {
        id: uuid.v4(),
        value: '89',
        name: 'Yonne',
      },
      {
        id: uuid.v4(),
        value: '90',
        name: 'Territoire de Belfort',
      },
      {
        id: uuid.v4(),
        value: '91',
        name: 'Essonne',
      },
      {
        id: uuid.v4(),
        value: '92',
        name: 'Hauts-de-Seine',
      },
      {
        id: uuid.v4(),
        value: '93',
        name: 'Seine-Saint-Denis',
      },
      {
        id: uuid.v4(),
        value: '94',
        name: 'Val-de-Marne',
      },
      {
        id: uuid.v4(),
        value: '95',
        name: "Val-d'Oise",
      },
      {
        id: uuid.v4(),
        value: '971',
        name: 'Guadeloupe',
      },
      {
        id: uuid.v4(),
        value: '972',
        name: 'Martinique',
      },
      {
        id: uuid.v4(),
        value: '973',
        name: 'Guyane',
      },
      {
        id: uuid.v4(),
        value: '974',
        name: 'La Réunion',
      },
      {
        id: uuid.v4(),
        value: '976',
        name: 'Mayotte',
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Departments', null, {});
  },
};
