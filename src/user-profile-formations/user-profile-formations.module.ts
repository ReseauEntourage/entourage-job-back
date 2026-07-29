import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Formation, FormationSkill } from 'src/formations/models';
import { SkillsModule } from 'src/skills/skills.module';
import { UserProfileFormationsService } from './user-profile-formations.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Formation, FormationSkill]),
    SkillsModule,
  ],
  providers: [UserProfileFormationsService],
  exports: [SequelizeModule, UserProfileFormationsService],
})
export class UserProfileFormationsModule {}
