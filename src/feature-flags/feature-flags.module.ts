import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserFeatureFlag } from './models/user-feature-flag.model';

@Module({
  imports: [SequelizeModule.forFeature([UserFeatureFlag])],
  exports: [SequelizeModule],
})
export class FeatureFlagsModule {}
