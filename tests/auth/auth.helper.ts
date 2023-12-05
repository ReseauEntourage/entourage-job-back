import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class AuthHelper {
  constructor(private authService: AuthService) {}

  async getResetToken(userId: string) {
    const { token } = await this.authService.generateResetToken(userId);
    return token;
  }
}
