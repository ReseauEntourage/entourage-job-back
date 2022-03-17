import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/models/user.model';
import { AuthService, PayloadUser } from '../../src/auth/auth.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthHelper {
  constructor(
    private usersService: UsersService,
    private authService: AuthService,
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
