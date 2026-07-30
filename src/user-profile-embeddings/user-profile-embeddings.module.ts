import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { VoyageAiModule } from 'src/external-services/voyageai/voyageai.module';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileEmbedding } from 'src/user-profiles/models/user-profile-embedding.model';
import { UserProfileEmbeddingsService } from './user-profile-embeddings.service';

@Module({
  imports: [
    SequelizeModule.forFeature([UserProfile, UserProfileEmbedding]),
    VoyageAiModule,
  ],
  providers: [UserProfileEmbeddingsService],
  exports: [SequelizeModule, UserProfileEmbeddingsService],
})
export class UserProfileEmbeddingsModule {}
