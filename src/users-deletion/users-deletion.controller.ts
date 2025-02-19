import {
  Controller,
  Delete,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { MailsService } from 'src/mails/mails.service';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { Permissions } from 'src/users/users.types';
import { UsersDeletionService } from './users-deletion.service';

// TODO change to users
@ApiTags('Users')
@ApiBearerAuth()
@Controller('user')
export class UsersDeletionController {
  constructor(
    private readonly usersDeletionService: UsersDeletionService,
    private readonly mailService: MailsService
  ) {}

  @Delete('me')
  async removeOwnUser(@UserPayload('id') userId: string) {
    const user = await this.usersDeletionService.findOneUser(userId);

    const { userDeleted, cvsDeleted } =
      await this.usersDeletionService.deleteCompleteUser(user);

    if (userDeleted) {
      await this.mailService.sendUserDeletionEmail(user);
    }
    return { userDeleted, cvsDeleted };
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Delete(':id')
  async removeUser(@Param('id', new ParseUUIDPipe()) userId: string) {
    const user = await this.usersDeletionService.findOneUser(userId);

    if (!user) {
      throw new NotFoundException();
    }

    const { userDeleted, cvsDeleted } =
      await this.usersDeletionService.deleteCompleteUser(user);

    return { userDeleted, cvsDeleted };
  }
}
