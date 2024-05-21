import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import validator from 'validator';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/users/models';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string): Promise<User> {
    if (!email || !password || !validator.isEmail(email)) {
      throw new BadRequestException();
    }

    const user = await this.authService.validateUser(email, password);

    if (user && !user.isEmailVerified) {
      throw new UnauthorizedException('UNVERIFIED_EMAIL');
    }
    if (!user || !!user.deletedAt) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
