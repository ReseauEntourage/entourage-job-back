import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmbeddingBuilder } from 'src/embeddings/embedding.builder';
import { EMBEDDING_CONFIG, SCORING_WEIGHTS } from 'src/embeddings/embedding.config';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import {
  PusherChannels,
  PusherEvents,
} from 'src/external-services/pusher/pusher.types';
import {
  Jobs,
  Queues,
  UpdateUserProfileEmbeddingsJob,
  UpdateUserProfileEmbeddingsBatchJob,
} from 'src/queues/queues.types';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileRecommendationsService } from 'src/user-profiles/recommendations/user-profile-recommendations-ai.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';
import { OnboardingStatus, UserRoles } from 'src/users/users.types';
import { UsersService } from 'src/users/users.service';

@Processor(Queues.EMBEDDING, {
  limiter: {
    max: 1,
    duration: 1 * 60 * 1000, // 1 job per minute to respect rate limits of the embedding API
  },
})
export class EmbeddingQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingQueueProcessor.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly userProfilesService: UserProfilesService,
    private readonly embeddingBuilder: EmbeddingBuilder,
    private readonly pusherService: PusherService,
    private readonly userProfileRecommendationsService: UserProfileRecommendationsService
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

    if (user.onboardingStatus !== OnboardingStatus.COMPLETED) {
      await this.dispatchWizardSuggestions(user);
    }

    return `Embeddings updated for user ${userId} with embedding types: ${embeddingTypes.join(
      ', '
    )}`;
  }

  /**
   * Dispatch top matching profiles via Pusher to the user's wizard suggestions channel.
   * Only called when the user has not yet completed onboarding.
   * @param user - The user for whom embeddings were just computed
   */
  private async dispatchWizardSuggestions(user: User): Promise<void> {
    try {
      const rolesToFind =
        user.role === UserRoles.CANDIDATE
          ? [UserRoles.COACH]
          : [UserRoles.CANDIDATE];

      const scoringResults =
        await this.userProfileRecommendationsService.findBySimilarity({
          userId: user.id,
          rolesToFind,
          configVersionProfile: EMBEDDING_CONFIG.profile.version,
          configVersionNeeds: EMBEDDING_CONFIG.needs.version,
          weightProfile: SCORING_WEIGHTS.profile,
          weightNeeds: SCORING_WEIGHTS.needs,
          weightActivity: SCORING_WEIGHTS.activity,
          weightLocationCompatibility: SCORING_WEIGHTS.locationCompatibility,
          poolSize: 5,
          annPoolSize: 10,
          filterByAvailability: true,
        });

      if (scoringResults.length === 0) {
        return;
      }

      const topUserIds = scoringResults.slice(0, 5).map((r) => r.userId);
      const profiles = await this.usersService.findByIdsWithRelations(topUserIds);

      const suggestions = profiles.map((p) => ({
        userId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        city: p.userProfile?.city ?? null,
        isAvailable: p.userProfile?.isAvailable ?? false,
        mainSector: p.userProfile?.sectorOccupations?.[0]?.name ?? null,
      }));

      await this.pusherService.sendEvent(
        `${PusherChannels.WIZARD_SUGGESTIONS}-${user.id}`,
        PusherEvents.WIZARD_SUGGESTIONS_READY,
        { profiles: suggestions }
      );
    } catch (error) {
      this.logger.error(
        `Failed to dispatch wizard suggestions for user ${user.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
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

        // Store embeddings for each user profile individually with error handling
        const saveResults = await Promise.allSettled(
          embeddingDataArray.map(
            async (
              {
                userId,
                userProfileId,
              }: { userId: string; userProfileId: string },
              index: number
            ) => {
              try {
                const embeddingArray = embeddingsArrays[index];
                const embedding = `[${embeddingArray.join(',')}]`;
                await this.userProfilesService.saveEmbedding(
                  userProfileId,
                  embeddingType,
                  embedding
                );
                return { success: true, userId };
              } catch (error) {
                const errorMsg = `Failed to save ${embeddingType} embedding for user ${userId}: ${
                  error instanceof Error ? error.message : String(error)
                }`;
                this.logger.error(errorMsg);
                return { success: false, userId, error: errorMsg };
              }
            }
          )
        );

        // Count successes and failures
        const successfulSaves = saveResults.filter(
          (result) => result.status === 'fulfilled' && result.value.success
        ).length;
        const failedSaves = saveResults.filter(
          (result) =>
            result.status === 'rejected' ||
            (result.status === 'fulfilled' && !result.value.success)
        );

        if (failedSaves.length > 0) {
          const failedUserIds = failedSaves
            .map((result) => {
              if (result.status === 'fulfilled') {
                return result.value.userId;
              }
              return 'unknown';
            })
            .join(', ');
          const errorMsg = `Failed to save ${embeddingType} embeddings for ${failedSaves.length} user(s): ${failedUserIds}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }

        successCount += successfulSaves;
        this.logger.log(
          `Successfully generated ${embeddingType} embeddings for ${successfulSaves} users`
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

    // Throw an error if any embeddings failed to generate
    if (errors.length > 0) {
      const errorMessage = `Batch failed with ${
        errors.length
      } error(s): ${errors.join('; ')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    return `Batch completed: ${successCount} embeddings updated for ${validUsersData.length} users. Invalid users: ${invalidCount}`;
  }
}
