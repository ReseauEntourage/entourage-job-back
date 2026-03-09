'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('UserProfileEmbeddings', 'embedding', {
      type: 'vector(1024)',
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('UserProfileEmbeddings', 'embedding', {
      type: 'vector(1536)',
      allowNull: false,
    });
  },
};
