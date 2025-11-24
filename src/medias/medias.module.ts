import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { UsersModule } from 'src/users/users.module';
import { MediasService } from './medias.service';
import { Media } from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([Media]),
    AWSModule,
    forwardRef(() => UsersModule),
  ],
  providers: [MediasService],
  exports: [SequelizeModule, MediasService],
})
export class MediasModule {}
