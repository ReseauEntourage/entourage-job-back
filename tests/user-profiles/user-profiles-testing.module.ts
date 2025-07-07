import { Module } from '@nestjs/common';
import { ExperiencesTestingModule } from 'tests/common/experiences/experiences-testing.module';
import { FormationsTestingModule } from 'tests/common/formations/formations-testing.module';
import { SkillsTestingModule } from 'tests/common/skills/skills-testing.module';
import { MessagesTestingModule } from 'tests/messages/messages-testing.module';
import { NudgesTestingModule } from 'tests/nudges/nudges-testing.module';
import { UsersTestingModule } from 'tests/users/users-testing.module';

@Module({
  imports: [
    UsersTestingModule,
    MessagesTestingModule,
    ExperiencesTestingModule,
    FormationsTestingModule,
    NudgesTestingModule,
    SkillsTestingModule,
  ],
  providers: [],
  exports: [],
})
export class UserProfilesTestingModule {}
