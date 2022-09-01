import { ApiProperty } from '@nestjs/swagger';
import { User } from '../models';

export class CreateUserDto extends User {
  @ApiProperty()
  userToCoach?: string;
}
