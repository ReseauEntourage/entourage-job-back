import { ElearningAnswer } from './models/elearning-answer.model';
import { ElearningCompletion } from './models/elearning-completion.model';
import { ElearningQuestion } from './models/elearning-question.model';
import { ElearningUnitRole } from './models/elearning-unit-role.model';
import { ElearningUnit } from './models/elearning-unit.model';

export const ELEARNING_UNIT_ATTRIBUTES: (keyof ElearningUnit)[] = [
  'id',
  'title',
  'description',
  'videoUrl',
  'durationMinutes',
  'order',
];

export const ELEARNING_QUESTION_ATTRIBUTES: (keyof ElearningQuestion)[] = [
  'id',
  'label',
  'order',
];

export const ELEARNING_ANSWER_ATTRIBUTES: (keyof ElearningAnswer)[] = [
  'id',
  'label',
  'isCorrect',
];

export const ELEARNING_UNIT_ROLE_ATTRIBUTES: (keyof ElearningUnitRole)[] = [
  'role',
];

export const ELEARNING_COMPLETION_ATTRIBUTES: (keyof ElearningCompletion)[] = [
  'id',
  'userId',
  'unitId',
  'validatedAt',
];
