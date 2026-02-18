// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as uuid from 'uuid';
import { ElearningAnswer } from 'src/elearning/models/elearning-answer.model';
import { ElearningQuestion } from 'src/elearning/models/elearning-question.model';
import { ElearningUnitRole } from 'src/elearning/models/elearning-unit-role.model';
import { ElearningUnit } from 'src/elearning/models/elearning-unit.model';
import { UserRole, UserRoles } from 'src/users/users.types';
import { Factory } from 'src/utils/types';

@Injectable()
export class ElearningUnitFactory implements Factory<ElearningUnit> {
  constructor(
    @InjectModel(ElearningUnit)
    private elearningUnitModel: typeof ElearningUnit,
    @InjectModel(ElearningUnitRole)
    private elearningUnitRoleModel: typeof ElearningUnitRole,
    @InjectModel(ElearningQuestion)
    private elearningQuestionModel: typeof ElearningQuestion,
    @InjectModel(ElearningAnswer)
    private elearningAnswerModel: typeof ElearningAnswer
  ) {}

  generateUnit(props: Partial<ElearningUnit>): Partial<ElearningUnit> {
    return {
      id: props.id ?? uuid.v4(),
      title: props.title ?? faker.lorem.sentence(4),
      description: props.description ?? faker.lorem.sentence(8),
      videoUrl: props.videoUrl ?? faker.internet.url(),
      durationMinutes:
        props.durationMinutes ?? faker.datatype.number({ min: 1, max: 90 }),
      order: props.order ?? faker.datatype.number({ min: 1, max: 100 }),
    };
  }

  async create(
    props: Partial<ElearningUnit> = {},
    options: {
      roles?: UserRole[];
      questions?: Array<{
        label?: string;
        order?: number;
        answers?: Array<{
          label?: string;
          isCorrect?: boolean;
          explanation?: string;
        }>;
      }>;
    } = {}
  ): Promise<ElearningUnit> {
    const unitData = this.generateUnit(props);
    const unit = await this.elearningUnitModel.create(unitData);

    const roles = options.roles ?? [UserRoles.CANDIDATE];
    if (roles.length > 0) {
      await Promise.all(
        roles.map((role) =>
          this.elearningUnitRoleModel.create({
            id: uuid.v4(),
            unitId: unit.id,
            role,
          })
        )
      );
    }

    if (options.questions && options.questions.length > 0) {
      for (const [index, question] of options.questions.entries()) {
        const createdQuestion = await this.elearningQuestionModel.create({
          id: uuid.v4(),
          unitId: unit.id,
          label: question.label ?? faker.lorem.sentence(6),
          order: question.order ?? index + 1,
        });

        if (question.answers && question.answers.length > 0) {
          await Promise.all(
            question.answers.map((answer, answerIndex) =>
              this.elearningAnswerModel.create({
                id: uuid.v4(),
                questionId: createdQuestion.id,
                label: answer.label ?? faker.lorem.sentence(8),
                order: answerIndex + 1,
                isCorrect: answer.isCorrect ?? false,
                explanation: answer.explanation ?? faker.lorem.sentence(10),
              })
            )
          );
        }
      }
    }

    return unit;
  }
}
