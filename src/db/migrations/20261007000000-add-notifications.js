'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Generic notifications center: one row per recipient and subject,
      // the help groups being the first producer
      await queryInterface.createTable(
        'Notifications',
        {
          id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
          },
          // Recipient
          userId: {
            allowNull: false,
            type: Sequelize.UUID,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          // HELP_GROUP_REPLY | HELP_GROUP_REACTION (extensible)
          type: { allowNull: false, type: Sequelize.STRING(50) },
          // POST | POST_REPLY
          subjectType: { allowNull: false, type: Sequelize.STRING(30) },
          // No foreign key: polymorphic subject, checked by the producer
          subjectId: { allowNull: false, type: Sequelize.UUID },
          // Display context and emails setting
          groupId: {
            allowNull: true,
            type: Sequelize.UUID,
            references: { model: 'HelpGroups', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          // [{ actorId, eventId, at, seenAt?, emailedAt? }]
          events: {
            allowNull: false,
            type: Sequelize.JSONB,
            defaultValue: [],
          },
          // Set once every event of the row is seen
          seenAt: { allowNull: true, type: Sequelize.DATE },
          lastEventAt: { allowNull: false, type: Sequelize.DATE },
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
        'Notifications',
        ['userId', 'type', 'subjectType', 'subjectId'],
        {
          unique: true,
          name: 'notifications_user_id_type_subject_unique',
          transaction,
        }
      );
      await queryInterface.addIndex(
        'Notifications',
        ['userId', { name: 'lastEventAt', order: 'DESC' }],
        { name: 'notifications_user_id_last_event_at', transaction }
      );
      // Purge
      await queryInterface.addIndex('Notifications', ['lastEventAt'], {
        name: 'notifications_last_event_at',
        transaction,
      });
      // Removal of the events of a deleted or hidden message
      await queryInterface.addIndex('Notifications', ['subjectId'], {
        name: 'notifications_subject_id',
        transaction,
      });

      // Lower bound of the next weekly digest, and its idempotency
      await queryInterface.addColumn(
        'Users',
        'helpGroupsDigestSentAt',
        { allowNull: true, type: Sequelize.DATE },
        { transaction }
      );
      // "Emails de ce groupe": a new membership starts with emails enabled
      await queryInterface.addColumn(
        'HelpGroupMemberships',
        'emailsEnabled',
        { allowNull: false, type: Sequelize.BOOLEAN, defaultValue: true },
        { transaction }
      );

      // Weekly digest: discussions where the person wrote are excluded
      await queryInterface.addIndex('Posts', ['authorId'], {
        name: 'posts_author_id',
        transaction,
      });
      await queryInterface.addIndex('PostReplies', ['postId', 'authorId'], {
        name: 'post_replies_post_id_author_id',
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex(
        'PostReplies',
        'post_replies_post_id_author_id',
        { transaction }
      );
      await queryInterface.removeIndex('Posts', 'posts_author_id', {
        transaction,
      });
      await queryInterface.removeColumn(
        'HelpGroupMemberships',
        'emailsEnabled',
        { transaction }
      );
      await queryInterface.removeColumn('Users', 'helpGroupsDigestSentAt', {
        transaction,
      });
      await queryInterface.dropTable('Notifications', { transaction });
    });
  },
};
