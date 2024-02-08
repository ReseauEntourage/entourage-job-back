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
import moment from 'moment';
import { UserPayload } from 'src/auth/guards';
import { BusinessLineValue } from 'src/common/business-lines/business-lines.types';
import { Department } from 'src/common/locations/locations.types';
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
import { UserProfileRecommendation } from './models/user-profile-recommendation.model';
import { UserProfilesService } from './user-profiles.service';
import { HelpValue, PublicProfile } from './user-profiles.types';
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
    @Param('userId', new ParseUUIDPipe()) userId: string,
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
    role: UserRole[],
    @Query('search')
    search: string,
    @Query('helps')
    helps: HelpValue[],
    @Query('departments')
    departments: Department[],
    @Query('businessLines')
    businessLines: BusinessLineValue[]
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

    return this.userProfilesService.findAll(userId, {
      role,
      offset,
      limit,
      search,
      helps,
      departments,
      businessLines,
    });
  }

  @Self('params.userId')
  @UseGuards(SelfGuard)
  @UseInterceptors(FileInterceptor('profileImage', { dest: 'uploads/' }))
  @Post('/uploadImage/:userId')
  async uploadProfileImage(
    @Param('userId', new ParseUUIDPipe()) userId: string,
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
  async findByUserId(
    @UserPayload('id', new ParseUUIDPipe()) currentUserId: string,
    @Param('userId', new ParseUUIDPipe()) userIdToGet: string
  ) {
    const user = await this.userProfilesService.findOneUser(userIdToGet);

    const userProfile = await this.userProfilesService.findOneByUserId(
      userIdToGet
    );

    const lastSentMessage = await this.userProfilesService.getLastContact(
      currentUserId,
      userIdToGet
    );
    const lastReceivedMessage = await this.userProfilesService.getLastContact(
      userIdToGet,
      currentUserId
    );

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    if (user.role === UserRoles.ADMIN) {
      throw new BadRequestException();
    }

    return getPublicProfileFromUserAndUserProfile(
      user,
      userProfile,
      lastSentMessage?.createdAt,
      lastReceivedMessage?.createdAt
    );
  }

  @UserPermissions(Permissions.CANDIDATE, Permissions.RESTRICTED_COACH)
  @UseGuards(UserPermissionsGuard)
  @Self('params.userId')
  @UseGuards(SelfGuard)
  @Get('/:userId')
  async findRecommendations(
    @Param('userId', new ParseUUIDPipe()) userId: string
  ): Promise<PublicProfile[]> {
    const user = this.userProfilesService.findOneUser(userId);
    const userProfile = await this.userProfilesService.findOneByUserId(userId);

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    const oneWeekAgo = moment().subtract(1, 'week');

    if (moment(userProfile.lastRecommendationDate).isBefore(oneWeekAgo)) {
      await this.userProfilesService.removeRecommendationsByUserProfileId(
        userProfile.id
      );

      await this.userProfilesService.updateRecommendationsByUserProfileId(
        userProfile.id
      );

      await this.userProfilesService.updateByUserId(userId, {
        lastRecommendationDate: moment().toDate(),
      });
    }

    const recommendedProfiles =
      await this.userProfilesService.findRecommendationsByUserProfileId(
        userProfile.id
      );

    return Promise.all(
      recommendedProfiles.map(
        async (recommendedProfile): Promise<PublicProfile> => {
          const lastSentMessage = await this.userProfilesService.getLastContact(
            userId,
            recommendedProfile.userProfile.user.id
          );
          const lastReceivedMessage =
            await this.userProfilesService.getLastContact(
              recommendedProfile.userProfile.user.id,
              userId
            );

          const {
            userProfile: { user, ...restProfile },
          }: UserProfileRecommendation = recommendedProfile.toJSON();

          return {
            ...user,
            ...restProfile,
            lastSentMessage: lastSentMessage?.createdAt || null,
            lastReceivedMessage: lastReceivedMessage?.createdAt || null,
          };
        }
      )
    );
  }
}
