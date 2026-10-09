import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PusherModule } from 'src/external-services/pusher/pusher.module';
import { Notification } from './models';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * Generic notifications center (the bell). The producing domains (help
 * groups today) import it to write their events and register the presenter
 * of their types.
 */
@Module({
  imports: [SequelizeModule.forFeature([Notification]), PusherModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [SequelizeModule, NotificationsService],
})
export class NotificationsModule {}
