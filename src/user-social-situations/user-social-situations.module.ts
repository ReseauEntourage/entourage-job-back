import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from 'src/auth/auth.module';
import { ExternalDatabasesModule } from 'src/external-databases/external-databases.module';
import { MailsModule } from 'src/mails/mails.module';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { UserSocialSituation } from './models';
import { UserSocialSituationsController } from './user-social-situations.controller';
import { UserSocialSituationsService } from './user-social-situations.service';

@Module({
  imports: [
    SequelizeModule.forFeature([UserSocialSituation]),
    QueuesModule,
    MailsModule,
    ExternalDatabasesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [UserSocialSituationsController],
  providers: [UserSocialSituationsService],
  exports: [UserSocialSituationsService, SequelizeModule],
})
export class UserSocialSituationsModule {}
