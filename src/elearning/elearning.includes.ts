import { IncludeOptions } from 'sequelize';
import { UserRole } from 'src/users/users.types';
import {
  ELEARNING_QUESTION_ATTRIBUTES,
  ELEARNING_UNIT_ROLE_ATTRIBUTES,
  ELEARNING_ANSWER_ATTRIBUTES,
  ELEARNING_COMPLETION_ATTRIBUTES,
} from './elearning.attributes';
import { ElearningAnswer } from './models/elearning-answer.model';
import { ElearningCompletion } from './models/elearning-completion.model';
import { ElearningQuestion } from './models/elearning-question.model';
import { ElearningUnitRole } from './models/elearning-unit-role.model';

export const generateElearningQuestionsIncludes = (): IncludeOptions[] => [
  {
    model: ElearningAnswer,
    as: 'answers',
    attributes: ELEARNING_ANSWER_ATTRIBUTES,
  },
];

export const generateElearningUnitIncludes = ({
  userRole,
  userId,
}: {
  userRole?: UserRole;
  userId?: string;
}): IncludeOptions[] => [
  {
    model: ElearningQuestion,
    as: 'questions',
    attributes: ELEARNING_QUESTION_ATTRIBUTES,
    include: generateElearningQuestionsIncludes(),
  },
  {
    model: ElearningUnitRole,
    as: 'roles',
    attributes: ELEARNING_UNIT_ROLE_ATTRIBUTES,
    where: { ...(userRole ? { role: userRole } : {}) },
    required: userRole ? true : false,
  },
  {
    model: ElearningCompletion,
    as: 'userCompletions',
    attributes: ELEARNING_COMPLETION_ATTRIBUTES,
    where: { ...(userId ? { userId } : {}) },
    required: false,
  },
];
