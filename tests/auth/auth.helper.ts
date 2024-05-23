import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/users/models';

@Injectable()
export class AuthHelper {
  constructor(private authService: AuthService) {}

  async getResetToken(userId: string) {
    const { token } = await this.authService.generateResetToken(userId);
    return token;
  }

  async getVerifyEmailToken(user: User) {
    const token = await this.authService.generateVerificationToken(user);
    return token;
  }
}
