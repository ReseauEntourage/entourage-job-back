'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn(
        'ConversationParticipants',
        'assistantBannerDismissedAt',
        {
          allowNull: true,
          type: Sequelize.DATE,
          defaultValue: null,
        }
      ),
    ]);
  },
  down: (queryInterface) => {
    return Promise.all([
      queryInterface.removeColumn(
        'ConversationParticipants',
        'assistantBannerDismissedAt'
      ),
    ]);
  },
};
