'use strict';

const BATCH_SIZE = 500;

// Mirrors ConversationPipelineService: >=3 messages from each of the 2 participants
// is the LONG_TERM_SUPPORT threshold.
const LONG_TERM_SUPPORT_THRESHOLD = 3;

const getDirectConversationIdBatch = async (queryInterface, offset) => {
  const rows = await queryInterface.sequelize.query(
    `
      SELECT id FROM "Conversations"
      WHERE type = 'direct'
      ORDER BY id
      LIMIT :batchSize OFFSET :offset
    `,
    {
      type: queryInterface.sequelize.QueryTypes.SELECT,
      replacements: { batchSize: BATCH_SIZE, offset },
    }
  );
  return rows.map((row) => row.id);
};

// engagementThresholdReachedAt: earliest of firstMeetingDetectedAt (already backfilled
// by the pipeline-status migration) and the moment both participants each reach
// `LONG_TERM_SUPPORT_THRESHOLD` messages (the timestamp of whichever of the two 3rd
// messages comes later). Postgres' LEAST() ignores NULL arguments, so this also covers
// the case where only one of the two signals is present.
const backfillBatch = async (queryInterface, ids) => {
  await queryInterface.sequelize.query(
    `
      WITH ranked AS (
        SELECT "conversationId", "authorId", "createdAt",
          ROW_NUMBER() OVER (PARTITION BY "conversationId", "authorId" ORDER BY "createdAt") AS rn
        FROM "Messages"
        WHERE "conversationId" IN (:ids)
      ),
      third_msg AS (
        SELECT "conversationId", "authorId", "createdAt" AS third_at
        FROM ranked
        WHERE rn = :longTermThreshold
      ),
      per_conv_threshold AS (
        SELECT "conversationId", MAX(third_at) AS "stageThresholdAt"
        FROM third_msg
        GROUP BY "conversationId"
        HAVING COUNT(*) >= 2
      )
      UPDATE "Conversations" c
      SET "engagementThresholdReachedAt" = LEAST(c."firstMeetingDetectedAt", pct."stageThresholdAt")
      FROM (SELECT id FROM "Conversations" WHERE id IN (:ids)) target
      LEFT JOIN per_conv_threshold pct ON pct."conversationId" = target.id
      WHERE c.id = target.id
        AND (c."firstMeetingDetectedAt" IS NOT NULL OR pct."stageThresholdAt" IS NOT NULL)
    `,
    {
      replacements: { ids, longTermThreshold: LONG_TERM_SUPPORT_THRESHOLD },
    }
  );
};

// Adds the column only if it doesn't already exist, so the migration can be safely
// retried after a partial failure (e.g. one that occurred during the backfill loop,
// after the column was already committed on a previous attempt).
const addColumnIfMissing = async (
  queryInterface,
  tableName,
  columnName,
  spec
) => {
  const tableDescription = await queryInterface.describeTable(tableName);
  if (tableDescription[columnName]) {
    return;
  }
  await queryInterface.addColumn(tableName, columnName, spec);
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await addColumnIfMissing(
      queryInterface,
      'Conversations',
      'engagementThresholdReachedAt',
      {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      }
    );

    // Backfill by batches of direct conversation ids to avoid one giant transaction.
    // The UPDATE statement in backfillBatch is idempotent, so retrying this loop after
    // a partial failure (e.g. mid-backfill) simply recomputes already-correct rows.
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const ids = await getDirectConversationIdBatch(queryInterface, offset);
      if (ids.length === 0) break;
      await backfillBatch(queryInterface, ids);
      offset += BATCH_SIZE;
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn(
      'Conversations',
      'engagementThresholdReachedAt'
    );
  },
};
