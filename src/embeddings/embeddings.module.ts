import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { QueuesModule } from 'src/queues/producers';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileEmbedding } from 'src/user-profiles/models/user-profile-embedding.model';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { EmbeddingBuilder } from './embedding.builder';
import { EmbeddingsRegenerationService } from './embeddings-regeneration.service';

@Module({
  imports: [
    SequelizeModule.forFeature([UserProfile, UserProfileEmbedding]),
    UsersModule,
    UserProfilesModule,
    QueuesModule,
  ],
  providers: [EmbeddingBuilder, EmbeddingsRegenerationService],
  exports: [SequelizeModule, EmbeddingBuilder, EmbeddingsRegenerationService],
})
export class EmbeddingsModule {}
