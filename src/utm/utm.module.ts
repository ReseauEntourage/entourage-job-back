import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Utm } from './models';
import { UtmService } from './utm.service';

@Module({
  imports: [SequelizeModule.forFeature([Utm])],
  controllers: [],
  providers: [UtmService],
  exports: [UtmService],
})
export class UtmModule {}
