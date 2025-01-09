import * as dotenv from 'dotenv';
import { fetchAllUserProfiles, updateHasPicture } from './queries';
import { IOService } from './services/io.service';
import { S3Service } from './services/s3.service';
import { printMessage } from './utils/logger';

dotenv.config();

const s3 = new S3Service();
const io = new IOService();

async function fetchProfilePicturesIdsFromS3() {
  const allImages = await s3.fetchAllObjects('.profile.jpg');
  const allProfilePicturesIds = allImages.map((item) =>
    item.Key?.replace(`${process.env.AWSS3_IMAGE_DIRECTORY}`, '').replace(
      '.profile.jpg',
      ''
    )
  );
  return allProfilePicturesIds;
}

async function displayMatchingResults(
  succeedIds: string[],
  notFoundIds: string[]
) {
  printMessage(`${succeedIds.length} profile with picture`, 'success');
  printMessage(' - ');
  printMessage(`${notFoundIds.length} profile without picture\n\n`, 'warning');
}

async function confirmAndUpdate(succeedIds: string[]) {
  const confirmationMsg = `update ${succeedIds.length} row${
    succeedIds.length > 1 ? 's' : ''
  }`;
  const answer = await io.waitForInput(
    `\nType "${confirmationMsg}" to continue\n`
  );
  if (answer !== confirmationMsg) {
    printMessage('Aborted\n', 'error');
    process.exit(0);
  }

  const countUpdated = await updateHasPicture(succeedIds);

  if (countUpdated === 0) {
    printMessage(`➡ No row affected\n\n`, 'warning');
  } else {
    printMessage(
      `➡ ${countUpdated} row${countUpdated > 1 ? 's' : ''} affected\n\n`,
      'success'
    );
  }
}

async function main() {
  printMessage('👌 SYNC-USER-PROFILE-HAS-PICTURE\n', 'info');
  printMessage('\n');
  printMessage(
    '⚠️  This script will update the database, but you will be prompt before update\n\n',
    'warning'
  );

  printMessage('\n----------- SUMMARY ------------\n', 'info');
  printMessage(' 1. Fetch all user profiles\n', 'info');
  printMessage(' 2. Fetch all profile pictures from S3\n', 'info');
  printMessage(' 3. Display results\n', 'info');
  printMessage(' 4. Confirm and update\n\n\n\n', 'info');

  // Wait 5s before starting
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Fetch userProfiles
  printMessage('1. Contact the database to get all users...\n');
  const allUserProfiles = await fetchAllUserProfiles();
  printMessage(`${allUserProfiles.length} User_Profiles found.\n\n`, 'info');

  // Fetch profile pictures from S3
  printMessage('2. Contact AWS to fetch profile picture list\n');
  const allProfilePicturesIds = await fetchProfilePicturesIdsFromS3();
  printMessage(
    `${allProfilePicturesIds.length} profile picture found in S3\n\n`,
    'info'
  );

  // Compare
  const succeedIds: string[] = [];
  const notFoundIds: string[] = [];
  for (const userProfile of allUserProfiles) {
    if (allProfilePicturesIds.includes(userProfile.UserId)) {
      succeedIds.push(userProfile.UserId);
    } else {
      notFoundIds.push(userProfile.UserId);
    }
  }

  // Display results
  printMessage('3. Matching results:\n');
  await displayMatchingResults(succeedIds, notFoundIds);

  // Confirm and update
  printMessage('4. Update hasPicture:\n');
  await confirmAndUpdate(succeedIds);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
