import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DepartmentsModule } from 'src/common/departments/departments.module';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { UsersModule } from 'src/users/users.module';
import { UsersStatsModule } from 'src/users-stats/users-stats.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    SequelizeModule.forFeature([]),
    SalesforceModule,
    DepartmentsModule,
    UsersModule,
    UsersStatsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
