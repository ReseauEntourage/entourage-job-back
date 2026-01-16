import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ElearningController } from './elearning.controller';
import { ElearningService } from './elearning.service';
import { ElearningAnswer } from './models/elearning-answer.model';
import { ElearningCompletion } from './models/elearning-completion.model';
import { ElearningQuestion } from './models/elearning-question.model';
import { ElearningUnitRole } from './models/elearning-unit-role.model';
import { ElearningUnit } from './models/elearning-unit.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      ElearningUnit,
      ElearningUnitRole,
      ElearningQuestion,
      ElearningAnswer,
      ElearningCompletion,
    ]),
  ],
  controllers: [ElearningController],
  providers: [ElearningService],
  exports: [ElearningService],
})
export class ElearningModule {}
