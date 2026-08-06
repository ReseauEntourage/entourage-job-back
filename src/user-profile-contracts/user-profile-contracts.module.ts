import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Contract } from 'src/contracts/models';
import { UserProfileContract } from 'src/user-profiles/models/user-profile-contract.model';
import { UserProfileContractsService } from './user-profile-contracts.service';

@Module({
  imports: [SequelizeModule.forFeature([Contract, UserProfileContract])],
  providers: [UserProfileContractsService],
  exports: [SequelizeModule, UserProfileContractsService],
})
export class UserProfileContractsModule {}
