import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueError,
  OnQueueFailed,
  OnQueueWaiting,
  Process,
  Processor,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
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
export class EmbeddingQueueProcessor {
  private readonly logger = new Logger(EmbeddingQueueProcessor.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly userProfilesService: UserProfilesService,
    private readonly embeddingBuilder: EmbeddingBuilder
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    const timeInQueue = job.processedOn - job.timestamp;
    this.logger.log(
      `Job ${job.id} of type ${job.name} has started after waiting for ${timeInQueue} ms`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: string) {
    this.logger.log(
      `Job ${job.id} of type ${job.name} completed with result : "${result}"`
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error : "${error}"`,
      job.data
    );
  }

  @OnQueueWaiting()
  onWaiting(jobId: number | string) {
    this.logger.log(`Job ${jobId} is waiting to be processed`);
  }

  @OnQueueError()
  onError(error: Error) {
    this.logger.error(`An error occurred on the embedding queue : "${error}"`);
  }

  @Process()
  async process(job: Job) {
    this.logger.error(
      `No process method for this job ${job.id} with data ${JSON.stringify(
        job.data
      )}`
    );
  }

  @Process(Jobs.UPDATE_USER_PROFILE_EMBEDDINGS)
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

  @Process(Jobs.UPDATE_USER_PROFILE_EMBEDDINGS_BATCH)
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
