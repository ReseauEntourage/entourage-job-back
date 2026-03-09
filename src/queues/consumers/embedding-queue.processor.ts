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
} from 'src/queues/queues.types';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
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
    this.logger.error(`An error occurred on the work queue : "${error}"`);
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
    embeddingTypes.forEach((embeddingType) => {
      const embeddingData = this.embeddingBuilder.build(
        user.role,
        userProfile,
        embeddingType
      );
      this.userProfilesService.updateEmbedding(
        userProfile.id,
        embeddingType,
        embeddingData
      );
    });

    return `Embeddings updated for user ${userId} with embedding types: ${embeddingTypes.join(
      ', '
    )}`;
  }
}
