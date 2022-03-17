import { PartialType } from '@nestjs/mapped-types';
import { User } from '../models/user.model';

export class CreateUserDto extends User {}
