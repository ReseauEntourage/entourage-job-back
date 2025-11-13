import { Module } from '@nestjs/common';
import { UserProfilesModule } from 'src/user-profiles/user-profiles.module';
import { ExperiencesTestingModule } from 'tests/common/experiences/experiences-testing.module';
import { FormationsTestingModule } from 'tests/common/formations/formations-testing.module';
import { SkillsTestingModule } from 'tests/common/skills/skills-testing.module';
import { NudgesTestingModule } from 'tests/nudges/nudges-testing.module';
import { UsersTestingModule } from 'tests/users/users-testing.module';

@Module({
  imports: [
    UsersTestingModule,
    ExperiencesTestingModule,
    FormationsTestingModule,
    NudgesTestingModule,
    SkillsTestingModule,
    UserProfilesModule,
  ],
  providers: [],
  exports: [],
})
export class UserProfilesTestingModule {}
