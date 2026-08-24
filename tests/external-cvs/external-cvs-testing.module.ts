import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ExternalCv } from 'src/external-cvs/models/external-cv.model';
import { Media } from 'src/medias/models';
import { UsersModule } from 'src/users/users.module';
import { ExternalCvsHelper } from './external-cvs.helper';

@Module({
  imports: [UsersModule, SequelizeModule.forFeature([ExternalCv, Media])],
  providers: [ExternalCvsHelper],
  exports: [ExternalCvsHelper],
})
export class ExternalCvsTestingModule {}
