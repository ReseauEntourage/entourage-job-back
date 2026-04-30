import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from 'src/users/models';
import { MailjetService } from './mailjet.service';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  providers: [MailjetService],
  exports: [MailjetService],
})
export class MailjetModule {}
