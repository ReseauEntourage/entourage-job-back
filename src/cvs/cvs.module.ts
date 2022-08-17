import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmbitionsModule } from 'src/ambitions/ambitions.module';
import { AWSModule } from 'src/aws/aws.module';
import { BusinessLinesModule } from 'src/businessLines/businessLines.module';
import { ContractsModule } from 'src/contracts/contracts.module';
import { ExperiencesModule } from 'src/experiences/experiences.module';
import { LanguagesModule } from 'src/languages/languages.module';
import { LocationsModule } from 'src/locations/locations.module';
import { MailsModule } from 'src/mails/mails.module';
import { PassionsModule } from 'src/passions/passions.module';
import { QueuesModule } from 'src/queues/producers';
import { ReviewsModule } from 'src/reviews/reviews.module';
import { SkillsModule } from 'src/skills/skills.module';
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
