import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsersModule } from 'src/users/users.module';
import { ReadDocument } from './models';
import { ReadDocumentsController } from './read-documents.controller';
import { ReadDocumentsService } from './read-documents.service';

@Module({
  imports: [SequelizeModule.forFeature([ReadDocument]), UsersModule],
  providers: [ReadDocumentsService],
  controllers: [ReadDocumentsController],
  exports: [SequelizeModule, ReadDocumentsService],
})
export class ReadDocumentsModule {}
