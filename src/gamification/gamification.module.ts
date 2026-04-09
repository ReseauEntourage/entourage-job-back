import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SlackModule } from 'src/external-services/slack/slack.module';
import { MailsModule } from 'src/mails/mails.module';
import { MessagingModule } from 'src/messaging/messaging.module';
import { UsersModule } from 'src/users/users.module';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { UserAchievement } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([UserAchievement]),
    SlackModule,
    MailsModule,
    forwardRef(() => MessagingModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService, SequelizeModule],
})
export class GamificationModule {}
