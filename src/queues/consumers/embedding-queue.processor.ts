import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmbeddingBuilder } from 'src/embeddings/embedding.builder';
import {
  Jobs,
  Queues,
  UpdateUserProfileEmbeddingsJob,
  UpdateUserProfileEmbeddingsBatchJob,
} from 'src/queues/queues.types';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';

@Processor(Queues.EMBEDDING)
export class EmbeddingQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingQueueProcessor.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly userProfilesService: UserProfilesService,
    private readonly embeddingBuilder: EmbeddingBuilder
  ) {
    super();
  }

  async process(job: Job): Promise<string> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case Jobs.UPDATE_USER_PROFILE_EMBEDDINGS:
        return this.generateUserProfileEmbeddings(
          job as Job<UpdateUserProfileEmbeddingsJob>
        );
      case Jobs.UPDATE_USER_PROFILE_EMBEDDINGS_BATCH:
        return this.generateUserProfileEmbeddingsBatch(
          job as Job<UpdateUserProfileEmbeddingsBatchJob>
        );
      default:
        this.logger.error(
          `No process method for job ${job.id} with name ${job.name}`
        );
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  async generateUserProfileEmbeddings(
    job: Job<UpdateUserProfileEmbeddingsJob>
  ) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    const { userId, embeddingTypes } = job.data;

    const user = await this.usersService.findOne(userId);
    const userProfile = await this.userProfilesService.findOneByUserId(
      userId,
      true
    );
    if (!user) {
      throw new Error(`User not found for userId: ${userId}`);
    }
    if (!userProfile) {
      throw new Error(`User profile not found for userId: ${userId}`);
    }

    // Generate embeddings for each specified embedding type
    await Promise.all(
      embeddingTypes.map(async (embeddingType) => {
        const embeddingData = this.embeddingBuilder.build(
          user.role,
          userProfile,
          embeddingType
        );
        await this.userProfilesService.updateEmbedding(
          userProfile.id,
          embeddingType,
          embeddingData
        );
      })
    );

    return `Embeddings updated for user ${userId} with embedding types: ${embeddingTypes.join(
      ', '
    )}`;
  }

  async generateUserProfileEmbeddingsBatch(
    job: Job<UpdateUserProfileEmbeddingsBatchJob>
  ) {
    this.logger.log(
      `Processing batch job ${job.id} for ${job.data.userIds.length} users`
    );
    const { userIds, embeddingTypes } = job.data;

    // Retrieve all users and their profiles
    const usersData = await Promise.all(
      userIds.map(async (userId: string) => {
        const user = await this.usersService.findOne(userId);
        const userProfile = await this.userProfilesService.findOneByUserId(
          userId,
          true
        );
        return { userId, user, userProfile };
      })
    );

    // Filter out invalid users
    const validUsersData = usersData.filter(
      ({
        user,
        userProfile,
      }: {
        user: User | null;
        userProfile: UserProfile | null;
      }) => user && userProfile
    ) as Array<{ userId: string; user: User; userProfile: UserProfile }>;

    if (validUsersData.length === 0) {
      throw new Error('No valid users found in batch');
    }

    const errors: string[] = [];
    let successCount = 0;

    // For each embedding type, process in batch
    for (const embeddingType of embeddingTypes) {
      try {
        // Build all embedding texts for this type
        const embeddingDataArray = validUsersData.map(
          ({
            user,
            userProfile,
          }: {
            user: User;
            userProfile: UserProfile;
          }) => ({
            userId: user.id,
            userProfileId: userProfile.id,
            data: this.embeddingBuilder.build(
              user.role,
              userProfile,
              embeddingType
            ),
          })
        );

        // Call the VoyageAI API once for all users
        const embeddingsArrays =
          await this.userProfilesService.generateEmbeddingsBatch(
            embeddingDataArray.map(
              (item: { userId: string; userProfileId: string; data: string }) =>
                item.data
            )
          );

        // Store embeddings for each user profile
        await Promise.all(
          embeddingDataArray.map(
            async (
              { userProfileId }: { userProfileId: string },
              index: number
            ) => {
              const embeddingArray = embeddingsArrays[index];
              const embedding = `[${embeddingArray.join(',')}]`;
              await this.userProfilesService.saveEmbedding(
                userProfileId,
                embeddingType,
                embedding
              );
            }
          )
        );

        successCount += validUsersData.length;
        this.logger.log(
          `Successfully generated ${embeddingType} embeddings for ${validUsersData.length} users`
        );
      } catch (error) {
        const errorMsg = `Failed to generate ${embeddingType} embeddings: ${
          error instanceof Error ? error.message : String(error)
        }`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const invalidCount = userIds.length - validUsersData.length;
    if (invalidCount > 0) {
      this.logger.warn(`Skipped ${invalidCount} invalid users in batch`);
    }

    return `Batch completed: ${successCount} embeddings updated for ${validUsersData.length} users. Invalid users: ${invalidCount}. Errors: ${errors.length}`;
  }
}
