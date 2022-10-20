import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { User } from '../models';
// TODO add validation on User
export class CreateUserDto extends User {
  @ApiProperty()
  @IsOptional()
  userToCoach?: string;
}
