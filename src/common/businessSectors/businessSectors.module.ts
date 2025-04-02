import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BusinessSector } from './models/businessSector.model';

@Module({
  imports: [SequelizeModule.forFeature([BusinessSector])],
  exports: [SequelizeModule],
})
export class BusinessSectorsModule {}
