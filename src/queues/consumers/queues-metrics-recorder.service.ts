import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { MetricsRecorder } from '@bull-board/metrics';
import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Queues } from '../queues.types';
import { QUEUES_METRICS_HISTORY_RETENTION_DAYS } from '../queues.utils';
import { REDIS_CLIENT } from 'src/redis/redis.module';

/**
 * Snapshots BullMQ's native per-minute metrics into long-retention Redis buckets, read by the
 * Bull-Board "historical metrics" provider. It lives in the worker, an always-on process.
 */
@Injectable()
export class QueuesMetricsRecorderService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(QueuesMetricsRecorderService.name);
  private recorder: MetricsRecorder;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @InjectQueue(Queues.WORK) workQueue: Queue,
    @InjectQueue(Queues.PROFILE_GENERATION) profileGenerationQueue: Queue,
    @InjectQueue(Queues.CRON_TASKS) cronTasksQueue: Queue,
    @InjectQueue(Queues.EMBEDDING) embeddingQueue: Queue
  ) {
    this.recorder = new MetricsRecorder({
      queues: [
        workQueue,
        profileGenerationQueue,
        cronTasksQueue,
        embeddingQueue,
      ].map((queue) => new BullMQAdapter(queue)),
      connection: this.redisClient,
      retentionDays: QUEUES_METRICS_HISTORY_RETENTION_DAYS,
      onSnapshotError: (error, queueName) =>
        this.logger.error(`Metrics snapshot failed for ${queueName}`, error),
    });
  }

  onModuleInit() {
    this.recorder.start();
  }

  onModuleDestroy() {
    this.recorder.stop();
  }
}
