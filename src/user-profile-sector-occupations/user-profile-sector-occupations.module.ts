import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Occupation } from 'src/occupations/models';
import { UserProfileSectorOccupation } from 'src/user-profiles/models';
import { UserProfileSectorOccupationsService } from './user-profile-sector-occupations.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Occupation, UserProfileSectorOccupation]),
  ],
  providers: [UserProfileSectorOccupationsService],
  exports: [SequelizeModule, UserProfileSectorOccupationsService],
})
export class UserProfileSectorOccupationsModule {}
