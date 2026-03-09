import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { UsersModule } from 'src/users/users.module';
import { EmbeddingBuilder } from './embedding.builder';

@Module({
  imports: [
    SequelizeModule.forFeature([]),
    forwardRef(() => UsersModule),
    forwardRef(() => UserProfilesModule),
  ],
  providers: [EmbeddingBuilder],
  exports: [SequelizeModule, EmbeddingBuilder],
})
export class EmbeddingsModule {}
