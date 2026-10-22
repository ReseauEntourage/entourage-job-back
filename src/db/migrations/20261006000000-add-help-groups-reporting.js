'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Generic reports: help group messages today, conversations and
      // profiles later (transverse "Signalements" change)
      await queryInterface.createTable(
        'Reports',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          // POST | POST_REPLY (CONVERSATION | USER_PROFILE reserved)
          targetType: { allowNull: false, type: Sequelize.STRING(30) },
          // No foreign key: polymorphic target, checked by the service
          targetId: { allowNull: false, type: Sequelize.UUID },
          reporterId: {
            allowNull: false,
            type: Sequelize.UUID,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          // SPAM | FRAUD | INSULTS | IN_DANGER | OTHER
          reason: { allowNull: false, type: Sequelize.STRING(30) },
          comment: { allowNull: true, type: Sequelize.STRING(1000) },
          // PENDING | RESOLVED
          status: {
            allowNull: false,
            type: Sequelize.STRING(20),
            defaultValue: 'PENDING',
          },
          resolvedAt: { allowNull: true, type: Sequelize.DATE },
          resolvedById: {
            allowNull: true,
            type: Sequelize.UUID,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          // RESTORED | DELETED
          resolution: { allowNull: true, type: Sequelize.STRING(20) },
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
      // A single report to handle per person and target
      await queryInterface.addIndex(
        'Reports',
        ['reporterId', 'targetType', 'targetId'],
        {
          unique: true,
          where: { status: 'PENDING' },
          name: 'reports_pending_reporter_target_unique',
          transaction,
        }
      );
      await queryInterface.addIndex(
        'Reports',
        ['targetType', 'targetId', 'status'],
        { name: 'reports_target_status', transaction }
      );

      // Set by the automatic hiding after reports, cleared by a restoration
      for (const table of ['Posts', 'PostReplies']) {
        await queryInterface.addColumn(
          table,
          'hiddenAt',
          { allowNull: true, type: Sequelize.DATE },
          { transaction }
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['Posts', 'PostReplies']) {
        await queryInterface.removeColumn(table, 'hiddenAt', { transaction });
      }
      await queryInterface.dropTable('Reports', { transaction });
    });
  },
};
