import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeMeta } from 'src/db/models/sequelize-meta.model';
import { SalesforceModule } from 'src/external-services/salesforce/salesforce.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [SequelizeModule.forFeature([SequelizeMeta]), SalesforceModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
