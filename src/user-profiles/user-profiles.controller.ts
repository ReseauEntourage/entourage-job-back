import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserPayload } from '../auth/guards';
import {
  Self,
  SelfGuard,
  UserPermissions,
  UserPermissionsGuard,
} from 'src/users/guards';
import {
  AllUserRoles,
  Permissions,
  UserRole,
  UserRoles,
} from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { UpdateCoachUserProfileDto } from './dto';
import { UpdateCandidateUserProfileDto } from './dto/update-candidate-user-profile.dto';
import { UpdateUserProfilePipe } from './dto/update-user-profile.pipe';
import { UserProfilesService } from './user-profiles.service';
import { getPublicProfileFromUserAndUserProfile } from './user-profiles.utils';

@Controller('user/profile')
export class UserProfilesController {
  constructor(private readonly userProfilesService: UserProfilesService) {}

  @UserPermissions(Permissions.CANDIDATE, Permissions.RESTRICTED_COACH)
  @UseGuards(UserPermissionsGuard)
  @Self('params.userId')
  @UseGuards(SelfGuard)
  @Put('/:userId')
  async updateByUserId(
    @Param('userId') userId: string,
    @Body(UpdateUserProfilePipe)
    updateUserProfileDto:
      | UpdateCandidateUserProfileDto
      | UpdateCoachUserProfileDto
  ) {
    const user = this.userProfilesService.findOneUser(userId);

    if (!user) {
      throw new NotFoundException();
    }

    const updatedUserProfile = await this.userProfilesService.updateByUserId(
      userId,
      updateUserProfileDto
    );

    if (!updatedUserProfile) {
      throw new NotFoundException();
    }

    return updatedUserProfile;
  }

  @Get()
  async findAll(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Query('limit', new ParseIntPipe())
    limit: number,
    @Query('offset', new ParseIntPipe())
    offset: number,
    @Query('role')
    role: UserRole[]
  ) {
    if (!role || role.length === 0) {
      throw new BadRequestException();
    }

    if (!isRoleIncluded(AllUserRoles, role)) {
      throw new BadRequestException();
    }

    if (role.includes(UserRoles.COACH_EXTERNAL)) {
      throw new BadRequestException();
    }

    return this.userProfilesService.findAll(userId, { role, offset, limit });
  }

  @Self('params.userId')
  @UseGuards(SelfGuard)
  @UseInterceptors(FileInterceptor('profileImage', { dest: 'uploads/' }))
  @Post('/uploadImage/:userId')
  async uploadProfileImage(
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException();
    }

    const user = await this.userProfilesService.findOneUser(userId);
    const userProfile = await this.userProfilesService.findOneByUserId(userId);

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    const profileImage = await this.userProfilesService.uploadProfileImage(
      userId,
      file
    );

    if (!profileImage) {
      throw new InternalServerErrorException();
    }

    return profileImage;
  }

  @Get('/:userId')
  async findByUserId(@Param('userId', new ParseUUIDPipe()) userId: string) {
    const user = await this.userProfilesService.findOneUser(userId);

    const userProfile = await this.userProfilesService.findOneByUserId(userId);

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    if (user.role === UserRoles.ADMIN) {
      throw new BadRequestException();
    }

    return getPublicProfileFromUserAndUserProfile(user, userProfile);
  }
}
