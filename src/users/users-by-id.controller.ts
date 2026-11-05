import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { validate as uuidValidate } from 'uuid';
import validator from 'validator';
import { withHasExternalCv } from 'src/user-profiles/user-profiles.utils';
import { Self, SelfGuard } from './guards';
import { AdminOverride } from './guards/admin-override.decorator';
import { User } from './models';
import { UsersService } from './users.service';

/**
 * `GET /users/:id` lives in its own controller, in a module imported last in
 * the application module, so that Express registers it after every static
 * `/users/...` route (`/users/public-cvs`, `/users/social-situations`,
 * `/users/profiles`, `/users/members`...). Otherwise `:id` would capture them
 * depending on the order in which Nest scans the modules.
 */
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersByIdController {
  constructor(private readonly usersService: UsersService) {}

  @AdminOverride()
  @Self('params.id')
  @UseGuards(SelfGuard)
  @Get(':id')
  async findUser(@Param('id') userId: string) {
    let user: User;
    if (validator.isEmail(userId)) {
      user = await this.usersService.findOneByMailWithRelations(userId);
    } else if (uuidValidate(userId)) {
      user = await this.usersService.findOneWithRelations(userId);
    } else {
      throw new BadRequestException();
    }

    if (!user) {
      throw new NotFoundException();
    }

    const { userProfile, ...restUser } = user.toJSON() as User;
    return {
      ...restUser,
      ...(userProfile ? { userProfile: withHasExternalCv(userProfile) } : {}),
    };
  }
}
