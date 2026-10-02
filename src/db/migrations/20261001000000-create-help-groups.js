'use strict';

const timestamps = (Sequelize) => ({
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
});

const userReference = (Sequelize, allowNull, onDelete) => ({
  allowNull,
  type: Sequelize.UUID,
  references: { model: 'Users', key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        'HelpGroups',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          name: { allowNull: false, type: Sequelize.STRING(80) },
          slug: { allowNull: false, type: Sequelize.STRING(100) },
          description: { allowNull: false, type: Sequelize.STRING(500) },
          // Max length (5000) is enforced by the DTO only
          charter: { allowNull: false, type: Sequelize.TEXT },
          publishedAt: { allowNull: true, type: Sequelize.DATE },
          pinnedAt: { allowNull: true, type: Sequelize.DATE },
          createdById: userReference(Sequelize, true, 'SET NULL'),
          deletedAt: { allowNull: true, type: Sequelize.DATE },
          deletedById: userReference(Sequelize, true, 'SET NULL'),
          ...timestamps(Sequelize),
        },
        { transaction }
      );
      await queryInterface.addIndex('HelpGroups', ['slug'], {
        unique: true,
        name: 'help_groups_slug_unique',
        transaction,
      });

      await queryInterface.createTable(
        'HelpGroupMemberships',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          groupId: {
            allowNull: false,
            type: Sequelize.UUID,
            references: { model: 'HelpGroups', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          userId: userReference(Sequelize, false, 'CASCADE'),
          charterAcceptedAt: { allowNull: true, type: Sequelize.DATE },
          leftAt: { allowNull: true, type: Sequelize.DATE },
          ...timestamps(Sequelize),
        },
        { transaction }
      );
      // Joining again after leaving creates a new row
      await queryInterface.addIndex(
        'HelpGroupMemberships',
        ['groupId', 'userId'],
        {
          unique: true,
          where: { leftAt: null },
          name: 'help_group_memberships_active_unique',
          transaction,
        }
      );

      await queryInterface.createTable(
        'Posts',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          authorId: userReference(Sequelize, false, 'CASCADE'),
          title: { allowNull: true, type: Sequelize.STRING(120) },
          // Max length (5000) is enforced by the DTO only
          content: { allowNull: false, type: Sequelize.TEXT },
          lastActivityAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
          editedAt: { allowNull: true, type: Sequelize.DATE },
          deletedAt: { allowNull: true, type: Sequelize.DATE },
          deletedById: userReference(Sequelize, true, 'SET NULL'),
          ...timestamps(Sequelize),
        },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX "posts_last_activity_at_id" ON "Posts" ("lastActivityAt" DESC, "id" DESC) WHERE "deletedAt" IS NULL;`,
        { transaction }
      );

      await queryInterface.createTable(
        'PostContexts',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          postId: {
            allowNull: false,
            type: Sequelize.UUID,
            references: { model: 'Posts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          helpGroupId: {
            allowNull: true,
            type: Sequelize.UUID,
            references: { model: 'HelpGroups', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          ...timestamps(Sequelize),
        },
        { transaction }
      );
      // Only one kind of context today: a future context adds its own nullable
      // FK column and turns this into "exactly one context column is set"
      await queryInterface.sequelize.query(
        `ALTER TABLE "PostContexts" ADD CONSTRAINT "post_contexts_one_context_check" CHECK ("helpGroupId" IS NOT NULL);`,
        { transaction }
      );
      await queryInterface.addIndex('PostContexts', ['postId', 'helpGroupId'], {
        unique: true,
        where: { helpGroupId: { [Sequelize.Op.ne]: null } },
        name: 'post_contexts_post_id_help_group_id_unique',
        transaction,
      });
      await queryInterface.addIndex('PostContexts', ['helpGroupId', 'postId'], {
        name: 'post_contexts_help_group_id_post_id',
        transaction,
      });

      await queryInterface.createTable(
        'PostReplies',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          postId: {
            allowNull: false,
            type: Sequelize.UUID,
            references: { model: 'Posts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          authorId: userReference(Sequelize, false, 'CASCADE'),
          // Max length (5000) is enforced by the DTO only
          content: { allowNull: false, type: Sequelize.TEXT },
          editedAt: { allowNull: true, type: Sequelize.DATE },
          deletedAt: { allowNull: true, type: Sequelize.DATE },
          deletedById: userReference(Sequelize, true, 'SET NULL'),
          ...timestamps(Sequelize),
        },
        { transaction }
      );
      await queryInterface.addIndex(
        'PostReplies',
        ['postId', 'createdAt', 'id'],
        {
          where: { deletedAt: null },
          name: 'post_replies_post_id_created_at_id',
          transaction,
        }
      );

      await queryInterface.createTable(
        'PostReactions',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          userId: userReference(Sequelize, false, 'CASCADE'),
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
          // Allowed palette is enforced by the DTO only
          emoji: { allowNull: false, type: Sequelize.STRING(8) },
          deletedAt: { allowNull: true, type: Sequelize.DATE },
          ...timestamps(Sequelize),
        },
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE "PostReactions" ADD CONSTRAINT "post_reactions_one_target_check" CHECK (("postId" IS NOT NULL)::int + ("replyId" IS NOT NULL)::int = 1);`,
        { transaction }
      );
      await queryInterface.addIndex('PostReactions', ['userId', 'postId'], {
        unique: true,
        where: { deletedAt: null, postId: { [Sequelize.Op.ne]: null } },
        name: 'post_reactions_user_id_post_id_unique',
        transaction,
      });
      await queryInterface.addIndex('PostReactions', ['userId', 'replyId'], {
        unique: true,
        where: { deletedAt: null, replyId: { [Sequelize.Op.ne]: null } },
        name: 'post_reactions_user_id_reply_id_unique',
        transaction,
      });
      // The unique indexes above lead with `userId`: these serve the
      // reactions summaries, which filter on the target only
      await queryInterface.addIndex('PostReactions', ['postId'], {
        where: { deletedAt: null, postId: { [Sequelize.Op.ne]: null } },
        name: 'post_reactions_post_id',
        transaction,
      });
      await queryInterface.addIndex('PostReactions', ['replyId'], {
        where: { deletedAt: null, replyId: { [Sequelize.Op.ne]: null } },
        name: 'post_reactions_reply_id',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('PostReactions', { transaction });
      await queryInterface.dropTable('PostReplies', { transaction });
      await queryInterface.dropTable('PostContexts', { transaction });
      await queryInterface.dropTable('Posts', { transaction });
      await queryInterface.dropTable('HelpGroupMemberships', { transaction });
      await queryInterface.dropTable('HelpGroups', { transaction });
    });
  },
};
