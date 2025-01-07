/* eslint-disable no-console */
import axios from 'axios';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

async function updateHasPicture() {
  const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: 5432,
    database: process.env.DB_NAME,
  });

  await client.connect();

  // Récupérer tous les utilisateurs
  const res = await client.query('SELECT "UserId" FROM "User_Profiles"');

  console.log(res.rows.length, 'User_Profiles found.');

  let idx = 0;
  let succeedIds: string[] = [];
  let notFoundIds: string[] = [];
  let failedIds: string[] = [];
  for (const userProfile of res.rows) {
    const imageUrl = `${process.env.AWSS3_URL}${process.env.AWSS3_IMAGE_DIRECTORY}${userProfile.UserId}.profile.jpg`;

    // Clean line and display the new one on each iteration
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `Checking image for user ${userProfile.UserId} (${idx + 1}/${
        res.rows.length
      })...\r`
    );
    try {
      await axios.head(imageUrl);

      succeedIds = [...succeedIds, userProfile.UserId];
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response &&
        error.response.status === 403
      ) {
        notFoundIds = [...notFoundIds, userProfile.UserId];
      } else {
        console.error(
          `Error checking image for user ${userProfile.UserId}:`,
          error
        );
        failedIds = [...failedIds, userProfile.UserId];
      }
    }
    idx++;
  }
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`\x1b[32m☑\x1b[0m Done`);

  if (failedIds.length > 0) {
    console.error(
      `\n\n\x1b[41m Failed to check image for users: ${failedIds.join(
        ', '
      )}\x1b[0m\n`
    );
  }

  // Add Heading "Results"
  console.log('\n\nResults:\n');

  console.log(
    `\n\x1b[32m${succeedIds.length} found\x1b[0m, \x1b[33m${succeedIds.length}${notFoundIds.length} not found\x1b[0m, \x1b[31m${failedIds.length} errors\x1b[0m.`
  );

  const update = await client.query(
    'UPDATE "User_Profiles" SET "hasPicture" = true WHERE "UserId" = ANY($1::uuid[])',
    [succeedIds]
  );

  await client.end();
  console.log(
    '\n\n',
    `➡ ${update.rowCount} rows were updated / ${succeedIds.length} found.`
  );

  if (failedIds.length > 0) {
    process.exit(1);
  }
}

updateHasPicture()
  .then(() => process.exit(0))
  .catch(() => {
    process.exit(1);
  });
