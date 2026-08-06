import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import { AppModule } from 'src/app.module';
import { ExternalCv } from 'src/external-cvs/models/external-cv.model';
import { S3Service } from 'src/external-services/aws/s3.service';
import { Media } from 'src/medias/models';
import { UserProfile } from 'src/user-profiles/models';

/**
 * One-off backfill: registers the CV files that pre-date the `Media` /
 * `ExternalCv` model.
 *
 * Before this change a CV was only tracked by `UserProfile.hasExternalCv`, the
 * file living at a key that was never stored but rebuilt on the fly. This
 * script resolves that key for every flagged profile, checks the object really
 * exists in S3, and registers it as-is — no object is copied, moved, renamed
 * or written.
 *
 * Run it (built app) with:
 *   node dist/scripts/migrate-external-cvs
 */

/** The exact key the legacy upload path wrote to. */
const buildLegacyS3Key = (userId: string) =>
  `${process.env.AWSS3_FILE_DIRECTORY}external-cvs/${userId}.pdf`;

async function migrateExternalCvs() {
  const logger = new Logger('MigrateExternalCvs');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const s3Service = app.get(S3Service);
    const userProfileModel = app.get<typeof UserProfile>(
      getModelToken(UserProfile)
    );
    const mediaModel = app.get<typeof Media>(getModelToken(Media));
    const externalCvModel = app.get<typeof ExternalCv>(
      getModelToken(ExternalCv)
    );

    const userProfiles = await userProfileModel.findAll({
      where: { hasExternalCv: true },
      attributes: ['id', 'userId', 'deletedAt'],
    });

    let migrated = 0;
    let skipped = 0;
    let alreadyMigrated = 0;

    for (const userProfile of userProfiles) {
      // Idempotent: a profile already linked to a CV is left untouched, so the
      // script can safely be re-run after a partial run.
      const existingExternalCv = await externalCvModel.findOne({
        where: { userProfileId: userProfile.id },
        paranoid: false,
      });
      if (existingExternalCv) {
        alreadyMigrated += 1;
        continue;
      }

      const s3Key = buildLegacyS3Key(userProfile.userId);

      let contentLength: number;
      try {
        const head = await s3Service.getHead(s3Key);
        contentLength = head?.ContentLength ?? 0;
      } catch {
        skipped += 1;
        logger.warn(
          `Skipped profile ${userProfile.id} (user ${userProfile.userId}): no S3 object at ${s3Key}`
        );
        continue;
      }

      const media = await mediaModel.create({
        name: 'cv.pdf',
        s3Key,
        mimeType: 'application/pdf',
        size: contentLength,
        userId: userProfile.userId,
      });

      await externalCvModel.create({
        userProfileId: userProfile.id,
        mediaId: media.id,
        deletedAt: userProfile.deletedAt,
      });

      migrated += 1;
    }

    logger.log(
      `Done — processed: ${userProfiles.length}, migrated: ${migrated}, already migrated: ${alreadyMigrated}, skipped (missing S3 object): ${skipped}`
    );
  } finally {
    await app.close();
  }
}

migrateExternalCvs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('External CVs migration failed:', error);
    process.exit(1);
  });
