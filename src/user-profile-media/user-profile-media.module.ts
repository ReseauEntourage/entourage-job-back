import { forwardRef, Module } from '@nestjs/common';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UserProfileMediaService } from './user-profile-media.service';

@Module({
  imports: [AWSModule, forwardRef(() => UserProfilesModule)],
  providers: [UserProfileMediaService],
  exports: [UserProfileMediaService],
})
export class UserProfileMediaModule {}
