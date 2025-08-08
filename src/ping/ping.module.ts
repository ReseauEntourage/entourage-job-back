import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeMeta } from 'src/db/models/sequelize-meta.model';
import { PingController } from './ping.controller';
import { PingService } from './ping.service';

@Module({
  imports: [SequelizeModule.forFeature([SequelizeMeta])],
  controllers: [PingController],
  providers: [PingService],
  exports: [SequelizeModule, PingService],
})
export class PingModule {}
