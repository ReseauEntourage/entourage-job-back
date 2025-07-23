import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfileNudge } from 'src/user-profiles/models/user-profile-nudge.model';
import { Nudge } from './models';
import { NudgesController } from './nudges.controller';
import { NudgesService } from './nudges.service';

@Module({
  imports: [SequelizeModule.forFeature([Nudge, UserProfileNudge])],
  providers: [NudgesService],
  controllers: [NudgesController],
  exports: [NudgesService],
})
export class NudgesModule {}
