import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { InterestsService } from './interests.service';
import { Interest } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Interest])],
  providers: [InterestsService],
  exports: [InterestsService],
})
export class InterestsModule {}
