import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CommunicationLogsService } from './communication-logs.service';
import { CommunicationLog } from './models';

/**
 * History of the SMS and emails sent to users. Exposes no route: it is only
 * written to by the work queue.
 */
@Module({
  imports: [SequelizeModule.forFeature([CommunicationLog])],
  providers: [CommunicationLogsService],
  exports: [SequelizeModule, CommunicationLogsService],
})
export class CommunicationLogsModule {}
