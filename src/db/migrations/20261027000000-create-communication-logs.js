'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // One row per SMS or email accepted by its provider. No address, phone
      // number or message content is ever stored here.
      await queryInterface.createTable(
        'CommunicationLogs',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          // Recipient user, deliberately without foreign key: the rows must
          // outlive the deletion of the account
          userId: { allowNull: false, type: Sequelize.UUID },
          channel: { allowNull: false, type: Sequelize.STRING(10) },
          // Template name for an email, message type for an SMS
          type: { allowNull: false, type: Sequelize.STRING(100) },
          // Identifiers of related entities only, keyed by role
          metadata: { allowNull: true, type: Sequelize.JSONB },
          sentAt: { allowNull: false, type: Sequelize.DATE },
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
        'CommunicationLogs',
        ['userId', 'createdAt'],
        {
          name: 'communication_logs_user_id_created_at',
          transaction,
        }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CommunicationLogs');
  },
};
