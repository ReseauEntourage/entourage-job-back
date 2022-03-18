import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/users/models/user.model';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AuthHelper {
  constructor(
    private usersService: UsersService,
    private authService: AuthService
  ) {}

  /**
   * Get the reset link, updated user and associated token
   *
   * @param {Object} user data
   * @param {string} user.id
   * @returns {Object} with three keys:
   * - updatedUser
   * - token
   * - link
   */
  async getResetLinkAndUser(user: User) {
    const { token } = await this.authService.generateResetToken(user);
    return {
      token,
      link: `reset/${user.id}/${token}`,
    };
  }
}
