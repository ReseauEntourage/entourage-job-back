import { forwardRef, Module } from '@nestjs/common';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { LinkedInController } from './linkedin.controller';
import { LinkedInService } from './linkedin.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => UserProfilesModule),
  ],
  controllers: [LinkedInController],
  providers: [LinkedInService],
  exports: [LinkedInService],
})
export class LinkedInModule {}
