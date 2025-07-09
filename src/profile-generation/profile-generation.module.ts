import { forwardRef, Module } from '@nestjs/common';
import { ExternalCvsModule } from 'src/external-cvs/external-cvs.module';
import { QueuesModule } from 'src/queues/producers/queues.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ProfileGenerationController } from './profile-generation.controller';

@Module({
  imports: [
    forwardRef(() => QueuesModule),
    ExternalCvsModule,
    forwardRef(() => UserProfilesModule),
  ],
  controllers: [ProfileGenerationController],
  exports: [QueuesModule],
})
export class ProfileGenerationModule {}
