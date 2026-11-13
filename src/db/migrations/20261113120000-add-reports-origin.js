'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // MEMBER | AUTOMATIC (a signalement without a human reporter, e.g. a
      // forbidden expression detected in a help group message)
      await queryInterface.addColumn(
        'Reports',
        'origin',
        {
          allowNull: false,
          type: Sequelize.STRING(20),
          defaultValue: 'MEMBER',
        },
        { transaction }
      );
      // `changeColumn` would re-add a duplicate FK constraint alongside the
      // existing one (its generated name differs on every call) without
      // reliably dropping the NOT NULL — a known quirk of this Sequelize
      // version on Postgres. Raw SQL touches only the nullability.
      await queryInterface.sequelize.query(
        'ALTER TABLE "Reports" ALTER COLUMN "reporterId" DROP NOT NULL',
        { transaction }
      );

      // Replaced by two narrower partial indexes: a MEMBER report dedups per
      // reporter, an AUTOMATIC one (no reporter) dedups per target alone
      await queryInterface.removeIndex(
        'Reports',
        'reports_pending_reporter_target_unique',
        { transaction }
      );
      await queryInterface.addIndex(
        'Reports',
        ['reporterId', 'targetType', 'targetId'],
        {
          unique: true,
          where: { status: 'PENDING', origin: 'MEMBER' },
          name: 'reports_pending_member_reporter_target_unique',
          transaction,
        }
      );
      await queryInterface.addIndex('Reports', ['targetType', 'targetId'], {
        unique: true,
        where: { status: 'PENDING', origin: 'AUTOMATIC' },
        name: 'reports_pending_automatic_target_unique',
        transaction,
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex(
        'Reports',
        'reports_pending_automatic_target_unique',
        { transaction }
      );
      await queryInterface.removeIndex(
        'Reports',
        'reports_pending_member_reporter_target_unique',
        { transaction }
      );
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

      await queryInterface.sequelize.query(
        'ALTER TABLE "Reports" ALTER COLUMN "reporterId" SET NOT NULL',
        { transaction }
      );
      await queryInterface.removeColumn('Reports', 'origin', { transaction });
    });
  },
};
