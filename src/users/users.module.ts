import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AWSModule } from '../aws';
import { MailsModule } from 'src/mails';
import { QueuesModule } from 'src/queues/producers';
import { UserCandidat, User } from './models';
import { UserCandidatsService } from './user-candidats.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CVsModule } from '../cvs';

@Module({
  imports: [
    SequelizeModule.forFeature([User, UserCandidat]),
    QueuesModule,
    MailsModule,
    // TODO fix forward ref
    forwardRef(() => CVsModule),
    /*  // TODO fix forward ref
    forwardRef(() => AWSModule),*/
  ],
  controllers: [UsersController],
  providers: [UsersService, UserCandidatsService],
  exports: [UsersService, UserCandidatsService, SequelizeModule],
})
export class UsersModule {}
