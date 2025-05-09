'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn(
      'UserProfiles',
      'description',
      'introduction'
    );
    await queryInterface.renameColumn('UserProfiles', 'story', 'description');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn(
      'UserProfiles',
      'introduction',
      'description_tmp'
    );
    await queryInterface.renameColumn('UserProfiles', 'description', 'story');
    await queryInterface.renameColumn(
      'UserProfiles',
      'description_tmp',
      'description'
    );
  },
};
