import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserProfile } from 'src/user-profiles/models';
import { UsersModule } from 'src/users/users.module';
import { PublicProfilesController } from './public-profiles.controller';
import { PublicProfilesService } from './public-profiles.services';

@Module({
  imports: [SequelizeModule.forFeature([UserProfile]), UsersModule],
  controllers: [PublicProfilesController],
  providers: [PublicProfilesService],
  exports: [SequelizeModule, PublicProfilesService],
})
export class PublicProfilesModule {}
