import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Nudge } from './models';
import { NudgesController } from './nudges.controller';
import { NudgesService } from './nudges.service';

@Module({
  imports: [SequelizeModule.forFeature([Nudge])],
  providers: [NudgesService],
  controllers: [NudgesController],
  exports: [SequelizeModule],
})
export class NudgesModule {}
