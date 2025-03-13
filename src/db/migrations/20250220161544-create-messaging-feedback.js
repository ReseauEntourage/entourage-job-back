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

// 'use strict';

// /** @type {import('sequelize-cli').Migration} */
// module.exports = {
//   async up(queryInterface, Sequelize) {
//     await queryInterface.createTable('ConversationFeedback', {
//       id: {
//         allowNull: false,
//         primaryKey: true,
//         type: Sequelize.UUID,
//         defaultValue: () => {
//           return UUID.v4();
//         },
//       },
//       conversationParticipantId: {
//         type: Sequelize.UUID,
//         unique: true,
//         allowNull: false,
//         references: {
//           model: 'ConversationParticipants',
//           key: 'id',
//         },
//       },
//       rating: {
//         allowNull: true,
//         type: Sequelize.INTEGER,
//         defaultValue: null,
//       },
//       createdAt: {
//         allowNull: false,
//         type: Sequelize.DATE,
//         defaultValue: Sequelize.NOW,
//       },
//     });

//     await queryInterface.addColumn(
//       'ConversationParticipants',
//       'conversationFeedbackId',
//       {
//         type: Sequelize.UUID,
//         allowNull: true,
//         defaultValue: null,
//         references: {
//           model: 'ConversationFeedback',
//           key: 'id',
//         },
//       }
//     );
//   },

//   async down(queryInterface, Sequelize) {
//     await queryInterface.removeColumn(
//       'ConversationParticipants',
//       'conversationFeedbackId'
//     );
//     await queryInterface.dropTable('ConversationFeedback');
//   },
// };
