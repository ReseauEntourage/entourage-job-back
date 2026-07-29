import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Experience, ExperienceSkill } from 'src/experiences/models';
import { SkillsModule } from 'src/skills/skills.module';
import { UserProfileExperiencesService } from './user-profile-experiences.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Experience, ExperienceSkill]),
    SkillsModule,
  ],
  providers: [UserProfileExperiencesService],
  exports: [SequelizeModule, UserProfileExperiencesService],
})
export class UserProfileExperiencesModule {}
