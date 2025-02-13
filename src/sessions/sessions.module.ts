import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Session } from './model/session.model';
import { SessionsService } from './sessions.service';

@Module({
  imports: [SequelizeModule.forFeature([Session])],
  providers: [SessionsService],
  exports: [SequelizeModule, SessionsService],
})
export class SessionsModule {}
