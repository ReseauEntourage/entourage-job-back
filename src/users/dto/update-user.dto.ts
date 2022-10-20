import { PartialType } from '@nestjs/swagger';
import { User } from '../models';

export class UpdateUserDto extends PartialType(User) {}
