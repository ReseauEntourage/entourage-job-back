import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MailsModule } from 'src/mails';
import { UsersModule } from 'src/users';
import { CVsService } from './cvs.service';
import { CVBusinessLine, CV } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([CV, CVBusinessLine]),
    // TODO fix forward ref
    forwardRef(() => UsersModule),
    MailsModule,
  ],
  providers: [CVsService],
  exports: [CVsService, SequelizeModule],
})
export class CVsModule {}
