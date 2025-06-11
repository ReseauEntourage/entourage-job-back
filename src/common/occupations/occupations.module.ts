import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Occupation } from './models/occupation.model';

@Module({
  imports: [SequelizeModule.forFeature([Occupation])],
  exports: [SequelizeModule],
})
export class OccupationsModule {}
