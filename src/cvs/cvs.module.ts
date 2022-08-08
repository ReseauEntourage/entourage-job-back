import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MailsModule } from 'src/mails';
import { UsersModule } from 'src/users';
import { CVsController } from './cvs.controller';
import { CVsService } from './cvs.service';
import { CVBusinessLine, CV, CVLocation } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([CV, CVBusinessLine, CVLocation]),
    // TODO fix forwardRef
    forwardRef(() => UsersModule),
    // TODO fix forwardRef
    forwardRef(() => MailsModule),
  ],
  providers: [CVsService],
  controllers: [CVsController],
  exports: [CVsService, SequelizeModule],
})
export class CVsModule {}
