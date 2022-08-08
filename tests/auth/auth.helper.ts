import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth';
import { User } from 'src/users';

@Injectable()
export class AuthHelper {
  constructor(private authService: AuthService) {}

  async getResetToken(user: User) {
    const { token } = await this.authService.generateResetToken(user);
    return token;
  }
}
