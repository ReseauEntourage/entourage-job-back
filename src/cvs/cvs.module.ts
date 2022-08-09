import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MailsModule } from 'src/mails/mails.module';
import { QueuesModule } from 'src/queues/producers';
import { UsersModule } from 'src/users/users.module';
import { CVsController } from './cvs.controller';
import { CVsService } from './cvs.service';
import { CVBusinessLine, CV, CVLocation } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([CV, CVBusinessLine, CVLocation]),
    QueuesModule,
    UsersModule,
    MailsModule,
  ],
  providers: [CVsService],
  controllers: [CVsController],
  exports: [CVsService, SequelizeModule],
})
export class CVsModule {}
