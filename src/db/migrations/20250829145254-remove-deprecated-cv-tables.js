'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove old Offers tables
    await queryInterface.dropTable('Opportunity_BusinessLines');
    await queryInterface.dropTable('OpportunityUser_Events');
    await queryInterface.dropTable('OpportunityUser_StatusChanges');
    await queryInterface.dropTable('Opportunity_Users');
    await queryInterface.dropTable('OpportunityUser_Referents');
    await queryInterface.dropTable('Opportunities');

    // Remove old CV tables
    await queryInterface.dropTable('CV_Ambitions');
    await queryInterface.dropTable('CV_BusinessLines');
    await queryInterface.dropTable('CV_Contracts');
    await queryInterface.dropTable('CV_Languages');
    await queryInterface.dropTable('CV_Passions');
    await queryInterface.dropTable('CV_Searches');
    await queryInterface.dropTable('CV_Skills');
    await queryInterface.dropTable('CV_Locations');
    await queryInterface.dropTable('Help_Needs');
    await queryInterface.dropTable('Help_Offers');
    await queryInterface.dropTable('Passions');
    await queryInterface.dropTable('DeprecatedContracts');
    await queryInterface.dropTable('DeprecatedExperience_Skills');
    await queryInterface.dropTable('DeprecatedExperiences');
    await queryInterface.dropTable('DeprecatedFormation_Skills');
    await queryInterface.dropTable('DeprecatedFormations');
    await queryInterface.dropTable('DeprecatedLanguages');
    await queryInterface.dropTable('DeprecatedReviews');
    await queryInterface.dropTable('DeprecatedSkills');
    await queryInterface.dropTable('User_Profile_Search_Ambitions');
    await queryInterface.dropTable('User_Profile_Search_BusinessLines');
    await queryInterface.dropTable('User_Profile_Network_BusinessLines');
    await queryInterface.dropTable('Shares');
    await queryInterface.dropTable('Ambitions');
    await queryInterface.dropTable('BusinessLines');
    await queryInterface.dropTable('CVs');
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
