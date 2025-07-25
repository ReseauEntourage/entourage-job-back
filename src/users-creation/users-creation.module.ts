import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { CompaniesModule } from 'src/companies/companies.module';
import { ExternalDatabasesModule } from 'src/external-databases/external-databases.module';
import { MailsModule } from 'src/mails/mails.module';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UserSocialSituationsModule } from 'src/user-social-situations/user-social-situations.module';
import { UsersModule } from 'src/users/users.module';
import { UtmModule } from 'src/utm/utm.module';
import { UsersCreationController } from './users-creation.controller';
import { UsersCreationService } from './users-creation.service';

@Module({
  imports: [
    MailsModule,
    forwardRef(() => UsersModule),
    forwardRef(() => UserProfilesModule),
    AuthModule,
    ExternalDatabasesModule,
    forwardRef(() => UserSocialSituationsModule),
    CompaniesModule,

    QueuesModule,
    UtmModule,
  ],
  controllers: [UsersCreationController],
  providers: [UsersCreationService],
})
export class UsersCreationModule {}
