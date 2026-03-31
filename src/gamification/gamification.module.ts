import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MessagingModule } from 'src/messaging/messaging.module';
import { UsersModule } from 'src/users/users.module';
import { GamificationService } from './gamification.service';
import { UserAchievement } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([UserAchievement]),
    forwardRef(() => MessagingModule),
    forwardRef(() => UsersModule),
  ],
  providers: [GamificationService],
  exports: [GamificationService, SequelizeModule],
})
export class GamificationModule {}
