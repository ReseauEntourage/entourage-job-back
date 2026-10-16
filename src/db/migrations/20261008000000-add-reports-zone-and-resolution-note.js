'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Zone of the reported person, frozen when the report is created: the
      // filter of the "Signalements" tab follows who the person was attached
      // to at that time, not their current zone
      await queryInterface.addColumn(
        'Reports',
        'zone',
        { allowNull: true, type: Sequelize.STRING },
        { transaction }
      );
      // Internal note of the admin closing a conversation or a profile
      await queryInterface.addColumn(
        'Reports',
        'resolutionNote',
        { allowNull: true, type: Sequelize.STRING(1000) },
        { transaction }
      );
      // `resolution` gains MANUAL: a varchar without constraint, nothing to
      // alter. The list of the tab filters on status and zone, sorted by date
      await queryInterface.sequelize.query(
        'CREATE INDEX "reports_status_zone_created_at" ON "Reports" ("status", "zone", "createdAt" DESC)',
        { transaction }
      );

      // Help group reports saved before this change: the zone of the author
      // of the message, deleted accounts and messages included
      await queryInterface.sequelize.query(
        `UPDATE "Reports" r
            SET "zone" = u."zone"
           FROM "Posts" p
           JOIN "Users" u ON u."id" = p."authorId"
          WHERE r."targetType" = 'POST'
            AND r."targetId" = p."id"
            AND r."zone" IS NULL`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE "Reports" r
            SET "zone" = u."zone"
           FROM "PostReplies" pr
           JOIN "Users" u ON u."id" = pr."authorId"
          WHERE r."targetType" = 'POST_REPLY'
            AND r."targetId" = pr."id"
            AND r."zone" IS NULL`,
        { transaction }
      );
      // No zone (author without one, or gone): followed by « Hors zone »
      await queryInterface.sequelize.query(
        `UPDATE "Reports" SET "zone" = 'HORS ZONE' WHERE "zone" IS NULL`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex(
        'Reports',
        'reports_status_zone_created_at',
        { transaction }
      );
      await queryInterface.removeColumn('Reports', 'resolutionNote', {
        transaction,
      });
      await queryInterface.removeColumn('Reports', 'zone', { transaction });
    });
  },
};
