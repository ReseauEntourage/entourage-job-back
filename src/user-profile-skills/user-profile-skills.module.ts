import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Skill } from 'src/skills/models';
import { UserProfileSkill } from 'src/user-profiles/models/user-profile-skill.model';
import { UserProfileSkillsService } from './user-profile-skills.service';

@Module({
  imports: [SequelizeModule.forFeature([Skill, UserProfileSkill])],
  providers: [UserProfileSkillsService],
  exports: [SequelizeModule, UserProfileSkillsService],
})
export class UserProfileSkillsModule {}
