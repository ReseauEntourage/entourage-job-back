import { PartialType } from '@nestjs/mapped-types';
import { CreateUserCandidatDto } from './create-user-candidat.dto';

export class UpdateUserCandidatDto extends PartialType(CreateUserCandidatDto) {}
