import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CommunicationLogEntry } from './communication-logs.types';
import { CommunicationLog } from './models';

@Injectable()
export class CommunicationLogsService {
  private readonly logger = new Logger(CommunicationLogsService.name);

  constructor(
    @InjectModel(CommunicationLog)
    private communicationLogModel: typeof CommunicationLog
  ) {}

  /**
   * Records communications accepted by their provider, in a single query.
   * Recording must never break a send: a failure is only logged, never thrown.
   */
  async recordSent(entries: CommunicationLogEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    try {
      const sentAt = new Date();
      await this.communicationLogModel.bulkCreate(
        entries.map(
          ({ userId, channel, type, metadata, providerMessageId }) => ({
            userId,
            channel,
            type,
            metadata: metadata ?? null,
            providerMessageId: providerMessageId ?? null,
            sentAt,
          })
        )
      );
    } catch (error) {
      this.logger.error(
        `Failed to record ${entries.length} communication log(s)`,
        error instanceof Error ? error.stack : undefined
      );
    }
  }
}
