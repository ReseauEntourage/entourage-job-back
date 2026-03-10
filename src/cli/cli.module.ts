import { Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { EmbeddingsModule } from 'src/embeddings/embeddings.module';
import { RegenerateEmbeddingsCommand } from './commands/regenerate-embeddings.command';

@Module({
  imports: [AppModule, EmbeddingsModule],
  providers: [RegenerateEmbeddingsCommand],
})
export class CliModule {}
