'use strict';

const OLD_INDEX = 'ai_assistant_sessions_conversation_user_unique';
const NEW_INDEX = 'ai_assistant_sessions_user_recipient_unique';

/**
 * Moves the AI assistant session from (conversation, user) to (user, recipient),
 * so that a session can exist before its conversation does.
 *
 * Everything runs in a single transaction (Postgres DDL is transactional), so
 * a failure leaves the schema untouched.
 *
 * Data caveat: when a user has several sessions for the same recipient, only
 * the one with the most recent assistant message is kept. The others are
 * deleted along with their messages and cannot be restored by `down`.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const columns = await queryInterface.describeTable(
        'AiAssistantSessions',
        { transaction }
      );
      if (columns.recipientId && !columns.conversationId) {
        // Already migrated: nothing to do.
        return;
      }

      if (!columns.recipientId) {
        await queryInterface.addColumn(
          'AiAssistantSessions',
          'recipientId',
          {
            allowNull: true,
            type: Sequelize.UUID,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          { transaction }
        );
      }

      // The recipient is the other participant of the direct conversation.
      await queryInterface.sequelize.query(
        `
        UPDATE "AiAssistantSessions" AS s
        SET "recipientId" = cp."userId"
        FROM "ConversationParticipants" AS cp
        JOIN "Conversations" AS c ON c."id" = cp."conversationId"
        WHERE s."conversationId" = cp."conversationId"
          AND s."recipientId" IS NULL
          AND c."type" = 'direct'
          AND cp."userId" <> s."userId"
        `,
        { transaction }
      );

      // Keep one session per (user, recipient): the one whose last assistant
      // message is the most recent (session creation date as a fallback, as
      // the session's own updatedAt is never touched by its messages).
      await queryInterface.sequelize.query(
        `
        DELETE FROM "AiAssistantSessions"
        WHERE "id" IN (
          SELECT "id" FROM (
            SELECT
              s."id",
              ROW_NUMBER() OVER (
                PARTITION BY s."userId", s."recipientId"
                ORDER BY COALESCE(
                  (
                    SELECT MAX(m."createdAt")
                    FROM "AiAssistantMessages" AS m
                    WHERE m."sessionId" = s."id"
                  ),
                  s."createdAt"
                ) DESC, s."id"
              ) AS rank
            FROM "AiAssistantSessions" AS s
            WHERE s."recipientId" IS NOT NULL
          ) AS ranked
          WHERE ranked.rank > 1
        )
        `,
        { transaction }
      );

      // Sessions whose recipient could not be resolved (e.g. group
      // conversations) cannot be reached any more: drop them.
      const [, unresolved] = await queryInterface.sequelize.query(
        `DELETE FROM "AiAssistantSessions" WHERE "recipientId" IS NULL`,
        { transaction }
      );
      console.info(
        `[ai-assistant-sessions-by-recipient] sessions without a resolvable recipient deleted: ${
          unresolved?.rowCount ?? 0
        }`
      );

      await queryInterface.sequelize.query(
        'ALTER TABLE "AiAssistantSessions" ALTER COLUMN "recipientId" SET NOT NULL',
        { transaction }
      );

      await queryInterface.removeIndex('AiAssistantSessions', OLD_INDEX, {
        transaction,
      });
      await queryInterface.removeColumn(
        'AiAssistantSessions',
        'conversationId',
        {
          transaction,
        }
      );
      await queryInterface.addIndex(
        'AiAssistantSessions',
        ['userId', 'recipientId'],
        { unique: true, name: NEW_INDEX, transaction }
      );
    });
  },

  /**
   * Restores the schema only. Sessions deleted by `up` (duplicates and
   * unresolved recipients) are not restored, and surviving sessions get no
   * conversation back (the column is nullable): restore a backup to go back
   * to the previous data.
   */
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('AiAssistantSessions', NEW_INDEX, {
        transaction,
      });
      await queryInterface.addColumn(
        'AiAssistantSessions',
        'conversationId',
        {
          allowNull: true,
          type: Sequelize.UUID,
          references: { model: 'Conversations', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        { transaction }
      );
      await queryInterface.addIndex(
        'AiAssistantSessions',
        ['conversationId', 'userId'],
        { unique: true, name: OLD_INDEX, transaction }
      );
      await queryInterface.removeColumn('AiAssistantSessions', 'recipientId', {
        transaction,
      });
    });
  },
};
