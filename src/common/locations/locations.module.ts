import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Location } from './models';

@Module({
  imports: [SequelizeModule.forFeature([Location])],
  exports: [SequelizeModule],
})
export class LocationsModule {}
