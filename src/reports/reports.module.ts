import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Report } from './models';
import { ReportsService } from './reports.service';

/**
 * Generic reports storage, shared by every reported domain (help group
 * messages today). Exposes no route.
 */
@Module({
  imports: [SequelizeModule.forFeature([Report])],
  providers: [ReportsService],
  exports: [SequelizeModule, ReportsService],
})
export class ReportsModule {}
