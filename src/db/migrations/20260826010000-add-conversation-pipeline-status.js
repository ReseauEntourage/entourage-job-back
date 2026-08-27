'use strict';

const BATCH_SIZE = 500;

// Mirrors ConversationPipelineService: >=3 messages from each of the 2 participants
// -> LONG_TERM_SUPPORT, >=1 message from each -> CONTACT_ESTABLISHED, else FIRST_CONTACT_INITIATED.
const LONG_TERM_SUPPORT_THRESHOLD = 3;
const INACTIVITY_THRESHOLD_DAYS = 30;

// Same regexes as ConversationPipelineService (French phone number, email, known
// videoconferencing domains), translated to Postgres regex syntax.
const PHONE_REGEX = '(\\+33\\s?|0)[1-9]([ .-]?\\d{2}){4}';
const EMAIL_REGEX = '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}';
const MEETING_LINK_REGEX =
  'https?://([a-z0-9-]+\\.)*(meet\\.google\\.com|zoom\\.us|teams\\.microsoft\\.com|teams\\.live\\.com|whereby\\.com|skype\\.com)';

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

const backfillBatch = async (queryInterface, ids) => {
  // stage
  await queryInterface.sequelize.query(
    `
      WITH msg_counts AS (
        SELECT "conversationId", "authorId", COUNT(*) AS cnt
        FROM "Messages"
        WHERE "conversationId" IN (:ids)
        GROUP BY "conversationId", "authorId"
      ),
      per_conv AS (
        SELECT "conversationId", COUNT(*) AS distinct_authors, MIN(cnt) AS min_cnt
        FROM msg_counts
        GROUP BY "conversationId"
      )
      UPDATE "Conversations" c
      SET stage = CASE
        WHEN pc.distinct_authors >= 2 AND pc.min_cnt >= :longTermThreshold THEN 'LONG_TERM_SUPPORT'
        WHEN pc.distinct_authors >= 2 THEN 'CONTACT_ESTABLISHED'
        ELSE 'FIRST_CONTACT_INITIATED'
      END
      FROM per_conv pc
      WHERE c.id = pc."conversationId" AND c.id IN (:ids)
    `,
    {
      replacements: { ids, longTermThreshold: LONG_TERM_SUPPORT_THRESHOLD },
    }
  );

  // activityStatus
  await queryInterface.sequelize.query(
    `
      UPDATE "Conversations" c
      SET "activityStatus" = CASE
        WHEN lm."lastMessageAt" >= NOW() - (:inactivityDays || ' days')::interval THEN 'ACTIVE'
        ELSE 'INACTIVE'
      END
      FROM (
        SELECT "conversationId", MAX("createdAt") AS "lastMessageAt"
        FROM "Messages"
        WHERE "conversationId" IN (:ids)
        GROUP BY "conversationId"
      ) lm
      WHERE c.id = lm."conversationId" AND c.id IN (:ids)
    `,
    {
      replacements: { ids, inactivityDays: INACTIVITY_THRESHOLD_DAYS },
    }
  );

  // firstMeetingDetectedAt: earliest message containing a phone/email/meeting-link
  // signal that was followed by a message from a different author.
  await queryInterface.sequelize.query(
    `
      WITH candidates AS (
        SELECT m.id, m."conversationId", m."authorId", m."createdAt"
        FROM "Messages" m
        WHERE m."conversationId" IN (:ids)
          AND (
            m.content ~ :phoneRegex
            OR m.content ~* :emailRegex
            OR m.content ~* :meetingLinkRegex
          )
      ),
      validated AS (
        SELECT c."conversationId", MIN(c."createdAt") AS "firstMeetingDetectedAt"
        FROM candidates c
        WHERE EXISTS (
          SELECT 1 FROM "Messages" reply
          WHERE reply."conversationId" = c."conversationId"
            AND reply."authorId" != c."authorId"
            AND reply."createdAt" > c."createdAt"
        )
        GROUP BY c."conversationId"
      )
      UPDATE "Conversations" conv
      SET "firstMeetingDetectedAt" = v."firstMeetingDetectedAt"
      FROM validated v
      WHERE conv.id = v."conversationId" AND conv.id IN (:ids)
    `,
    {
      replacements: {
        ids,
        phoneRegex: PHONE_REGEX,
        emailRegex: EMAIL_REGEX,
        meetingLinkRegex: MEETING_LINK_REGEX,
      },
    }
  );
};

// Adds the column only if it doesn't already exist, so the migration can be safely
// retried after a partial failure (e.g. one that occurred during the backfill loop,
// after the columns were already committed on a previous attempt).
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
    await addColumnIfMissing(queryInterface, 'Conversations', 'stage', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await addColumnIfMissing(
      queryInterface,
      'Conversations',
      'activityStatus',
      {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      }
    );
    await addColumnIfMissing(
      queryInterface,
      'Conversations',
      'firstMeetingDetectedAt',
      {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      }
    );
    await addColumnIfMissing(
      queryInterface,
      'ConversationParticipants',
      'archivedAt',
      {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      }
    );

    // Backfill by batches of direct conversation ids to avoid one giant transaction.
    // The UPDATE statements in backfillBatch are idempotent, so retrying this loop
    // after a partial failure (e.g. mid-backfill) simply recomputes already-correct rows.
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
    await queryInterface.removeColumn('Conversations', 'stage');
    await queryInterface.removeColumn('Conversations', 'activityStatus');
    await queryInterface.removeColumn(
      'Conversations',
      'firstMeetingDetectedAt'
    );
    await queryInterface.removeColumn('ConversationParticipants', 'archivedAt');
  },
};
