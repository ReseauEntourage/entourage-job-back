import { Module } from '@nestjs/common';
import { ReadDocumentsModule } from 'src/read-documents/read-documents.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [ReadDocumentsModule, UsersModule],
})
export class ReadDocumentsTestingModule {}
