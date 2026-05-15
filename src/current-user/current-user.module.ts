import { forwardRef, Module } from '@nestjs/common';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { ProfileGenerationModule } from 'src/profile-generation/profile-generation.module';
import { SessionsModule } from 'src/sessions/sessions.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { UsersStatsModule } from 'src/users-stats/users-stats.module';
import { CurrentUserController } from './current-user.controller';
import { CurrentUserService } from './current-user.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => UserProfilesModule),
    forwardRef(() => UsersStatsModule),
    SessionsModule,
    ProfileGenerationModule,
    SalesforceModule,
  ],
  controllers: [CurrentUserController],
  providers: [CurrentUserService],
  exports: [CurrentUserService],
})
export class CurrentUserModule {}
