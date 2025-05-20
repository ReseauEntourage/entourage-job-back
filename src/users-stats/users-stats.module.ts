import { forwardRef, Module } from '@nestjs/common';
import { MessagingModule } from 'src/messaging/messaging.module';
import { UsersStatsService } from './users-stats.service';

@Module({
  imports: [forwardRef(() => MessagingModule)],
  controllers: [],
  providers: [UsersStatsService],
  exports: [UsersStatsService],
})
export class UsersStatsModule {}
