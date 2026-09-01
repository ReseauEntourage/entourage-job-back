'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn(
      'ConversationParticipants',
      'feedbackRating'
    );
    await queryInterface.removeColumn(
      'ConversationParticipants',
      'feedbackDate'
    );
  },

  down: async (queryInterface, Sequelize) => {
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
};
