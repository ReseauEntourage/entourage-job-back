'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Slack moderation alerts of a reported target, kept to replace their
      // action buttons by a « Traité » status once its reports are handled
      await queryInterface.createTable(
        'ReportSlackMessages',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          // Same polymorphic target as `Reports`, without foreign key
          targetType: { allowNull: false, type: Sequelize.STRING(30) },
          targetId: { allowNull: false, type: Sequelize.UUID },
          // Slack channel id and timestamp: the identity of the message
          channel: { allowNull: false, type: Sequelize.STRING(50) },
          ts: { allowNull: false, type: Sequelize.STRING(50) },
          // Blocks as sent, rewritten when the reports are handled
          blocks: { allowNull: false, type: Sequelize.JSONB },
          handledAt: { allowNull: true, type: Sequelize.DATE },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
        },
        { transaction }
      );
      await queryInterface.addIndex(
        'ReportSlackMessages',
        ['targetType', 'targetId'],
        {
          where: { handledAt: null },
          name: 'report_slack_messages_unhandled_target',
          transaction,
        }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ReportSlackMessages');
  },
};
