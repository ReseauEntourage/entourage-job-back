import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmbitionsModule } from 'src/common/ambitions/ambitions.module';
import { BusinessLinesModule } from 'src/common/business-lines/business-lines.module';
import { ContractsModule } from 'src/common/contracts/contracts.module';
import { ExperiencesModule } from 'src/common/experiences/experiences.module';
import { LanguagesModule } from 'src/common/languages/languages.module';
import { LocationsModule } from 'src/common/locations/locations.module';
import { PassionsModule } from 'src/common/passions/passions.module';
import { ReviewsModule } from 'src/common/reviews/reviews.module';
import { SkillsModule } from 'src/common/skills/skills.module';
import { AWSModule } from 'src/external-services/aws/aws.module';
import { MailsModule } from 'src/mails/mails.module';
import { QueuesModule } from 'src/queues/producers';
import { UsersModule } from 'src/users/users.module';
import { CVsController } from './cvs.controller';
import { CVsService } from './cvs.service';
import {
  CVBusinessLine,
  CV,
  CVLocation,
  CVAmbition,
  CVContract,
  CVLanguage,
  CVPassion,
  CVSkill,
  CVSearch,
} from './models';

@Module({
  imports: [
    SequelizeModule.forFeature([
      CV,
      CVBusinessLine,
      CVLocation,
      CVAmbition,
      CVContract,
      CVLanguage,
      CVPassion,
      CVSkill,
      CVSearch,
    ]),
    UsersModule,
    BusinessLinesModule,
    LocationsModule,
    AmbitionsModule,
    ContractsModule,
    LanguagesModule,
    PassionsModule,
    SkillsModule,
    ExperiencesModule,
    ReviewsModule,
    QueuesModule,
    MailsModule,
    AWSModule,
  ],
  providers: [CVsService],
  controllers: [CVsController],
  exports: [CVsService, SequelizeModule],
})
export class CVsModule {}
