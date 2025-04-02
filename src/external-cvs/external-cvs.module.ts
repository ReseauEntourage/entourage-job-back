import { Module } from '@nestjs/common';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ExternalCvsController } from './external-cvs.controller';
import { ExternalCvsService } from './external-cvs.service';

@Module({
  imports: [UserProfilesModule, AWSModule],
  controllers: [ExternalCvsController],
  providers: [ExternalCvsService],
  exports: [ExternalCvsService],
})
export class ExternalCvsModule {}
