import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { User, UsersService } from 'src/users';

@Injectable()
export class AuthHelper {
  constructor(
    private usersService: UsersService,
    private authService: AuthService
  ) {}

  async getResetToken(user: User) {
    const { token } = await this.authService.generateResetToken(user);
    return token;
  }
}
