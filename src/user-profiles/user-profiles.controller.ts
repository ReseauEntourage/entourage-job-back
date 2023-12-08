import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { Permissions } from 'src/users/users.types';
import { UpdateUserProfileDto } from './dto';
import { UserProfilesService } from './user-profiles.service';

@Controller('user')
export class UserProfilesController {
  constructor(private readonly userProfilesService: UserProfilesService) {}

  @UserPermissions(Permissions.CANDIDATE, Permissions.COACH)
  @UseGuards(UserPermissionsGuard)
  @Put(':userId')
  updateByUserId(
    @Param('userId') userId: string,
    @Body() updateUserProfileDto: UpdateUserProfileDto
  ) {
    // TODO manage validation DTO
    return this.userProfilesService.updateByUserId(
      userId,
      updateUserProfileDto
    );
  }
}
