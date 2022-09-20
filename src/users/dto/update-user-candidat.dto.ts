import { PartialType } from '@nestjs/swagger';
import { CreateUserCandidatDto } from './create-user-candidat.dto';

export class UpdateUserCandidatDto extends PartialType(CreateUserCandidatDto) {}
