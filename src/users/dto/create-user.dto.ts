import { User } from '../models';

export class CreateUserDto extends User {
  userToCoach?: string;
}
