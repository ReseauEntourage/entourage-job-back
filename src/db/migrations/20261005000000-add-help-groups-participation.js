'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Previous versions of an edited post or reply: the current version
      // stays in the main row
      await queryInterface.createTable(
        'PostRevisions',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          postId: {
            allowNull: true,
            type: Sequelize.UUID,
            references: { model: 'Posts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          replyId: {
            allowNull: true,
            type: Sequelize.UUID,
            references: { model: 'PostReplies', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          title: { allowNull: true, type: Sequelize.STRING(120) },
          content: { allowNull: false, type: Sequelize.TEXT },
          editedById: {
            allowNull: true,
            type: Sequelize.UUID,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
        },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "PostRevisions" ADD CONSTRAINT "post_revisions_one_parent_check" CHECK (("postId" IS NOT NULL)::int + ("replyId" IS NOT NULL)::int = 1);`,
        { transaction }
      );
      await queryInterface.addIndex('PostRevisions', ['postId', 'createdAt'], {
        where: { postId: { [Sequelize.Op.ne]: null } },
        name: 'post_revisions_post_id_created_at',
        transaction,
      });
      await queryInterface.addIndex('PostRevisions', ['replyId', 'createdAt'], {
        where: { replyId: { [Sequelize.Op.ne]: null } },
        name: 'post_revisions_reply_id_created_at',
        transaction,
      });

      for (const table of ['Posts', 'PostReplies']) {
        // Set by a moderation deletion only: PERSONAL_DATA | DISRESPECT |
        // SPAM | OFF_TOPIC | OTHER
        await queryInterface.addColumn(
          table,
          'deletionReason',
          { allowNull: true, type: Sequelize.STRING(30) },
          { transaction }
        );
        await queryInterface.addColumn(
          table,
          'deletionComment',
          { allowNull: true, type: Sequelize.STRING(500) },
          { transaction }
        );
      }

      // AI_ACCEPTED | AI_EDITED | MANUAL
      await queryInterface.addColumn(
        'Posts',
        'titleSource',
        {
          allowNull: false,
          type: Sequelize.STRING(20),
          defaultValue: 'MANUAL',
        },
        { transaction }
      );

      // The help groups charter is common to every group and accepted once
      await queryInterface.addColumn(
        'Users',
        'helpGroupsCharterAcceptedAt',
        { allowNull: true, type: Sequelize.DATE },
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn(
        'Users',
        'helpGroupsCharterAcceptedAt',
        { transaction }
      );
      await queryInterface.removeColumn('Posts', 'titleSource', {
        transaction,
      });
      for (const table of ['Posts', 'PostReplies']) {
        await queryInterface.removeColumn(table, 'deletionComment', {
          transaction,
        });
        await queryInterface.removeColumn(table, 'deletionReason', {
          transaction,
        });
      }
      await queryInterface.dropTable('PostRevisions', { transaction });
    });
  },
};
