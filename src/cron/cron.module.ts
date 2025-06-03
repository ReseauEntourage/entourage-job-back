import { Module } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
import { UsersDeletionModule } from 'src/users-deletion/users-deletion.module';
import { CronService } from './cron.service';

@Module({
  imports: [UsersModule, UsersDeletionModule],
  providers: [CronService],
})
export class CronModule {}
