'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'ConversationParticipants',
      'feedbackRating',
      {
        allowNull: true,
        type: Sequelize.INTEGER,
        defaultValue: null,
      }
    );

    await queryInterface.addColumn('ConversationParticipants', 'feedbackDate', {
      allowNull: true,
      type: Sequelize.DATE,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn(
      'ConversationParticipants',
      'feedbackRating'
    );
    await queryInterface.removeColumn(
      'ConversationParticipants',
      'feedbackDate'
    );
  },
};
