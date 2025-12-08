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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import moment from 'moment';
import { validate as uuidValidate } from 'uuid';
import { UserPayload } from 'src/auth/guards';
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
import { ReportAbuseUserProfileDto } from './dto/report-abuse-user-profile.dto';
import { ReportAbuseUserProfilePipe } from './dto/report-abuse-user-profile.pipe';
import { UpdateCandidateUserProfileDto } from './dto/update-candidate-user-profile.dto';
import { UpdateUserProfilePipe } from './dto/update-user-profile.pipe';
import { generateUserProfileDto } from './dto/user-profile.dto';
import { UserProfileRecommendation } from './models/user-profile-recommendation.model';
import { UserProfilesService } from './user-profiles.service';
import { ContactTypeEnum, PublicProfile } from './user-profiles.types';
import { getPublicProfileFromUserAndUserProfile } from './user-profiles.utils';

@ApiTags('UserProfiles')
@ApiBearerAuth()
@Controller('user/profile')
export class UserProfilesController {
  constructor(private readonly userProfilesService: UserProfilesService) {}

  @ApiBearerAuth()
  @Get('/completion')
  async getProfileCompletion(
    @UserPayload('id', new ParseUUIDPipe()) id: string
  ) {
    return await this.userProfilesService.calculateProfileCompletion(id);
  }

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

    return generateUserProfileDto(updatedUserProfile, true);
  }

  @Post('/:userId/report')
  async reportAbuse(
    @UserPayload('id', new ParseUUIDPipe()) currentUserId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body(new ReportAbuseUserProfilePipe())
    reportAbuseDto: ReportAbuseUserProfileDto
  ): Promise<void> {
    // Set the reportedUser and reporterUser
    const userReported = await this.userProfilesService.findOneUser(userId);
    const userReporter = await this.userProfilesService.findOneUser(
      currentUserId
    );

    // Check users exists
    if (!userReported || !userReporter) {
      throw new NotFoundException();
    }

    return await this.userProfilesService.reportAbuse(
      reportAbuseDto,
      userReporter,
      userReported
    );
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
    @Query('nudgeIds')
    nudgeIds: string[],
    @Query('departments')
    departments: string[],
    @Query('businessSectorIds')
    businessSectorIds: string[],
    @Query('contactTypes')
    contactTypes: ContactTypeEnum[]
  ) {
    if (!role || role.length === 0) {
      throw new BadRequestException();
    }

    if (departments) {
      for (const dept of departments) {
        if (!uuidValidate(dept)) {
          throw new BadRequestException('departmentId must be a UUID or null');
        }
      }
    }

    if (!isRoleIncluded(AllUserRoles, role)) {
      console.error('Invalid role provided');
      throw new BadRequestException();
    }

    if (role.includes(UserRoles.REFERER)) {
      throw new BadRequestException();
    }

    try {
      return this.userProfilesService.findAll(userId, {
        role,
        offset,
        limit,
        search,
        nudgeIds,
        departments,
        businessSectorIds,
        contactTypes,
      });
    } catch (error) {
      console.error('Error in findAll:', error);
      throw new InternalServerErrorException();
    }
  }

  @UserPermissions(Permissions.REFERER)
  @UseGuards(UserPermissionsGuard)
  @Get('refered')
  async findReferedCandidates(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Query('limit', new ParseIntPipe())
    limit: number,
    @Query('offset', new ParseIntPipe())
    offset: number
  ) {
    return this.userProfilesService.findAllReferedCandidates(userId, {
      offset,
      limit,
    });
  }

  @UseInterceptors(FileInterceptor('profileImage', { dest: 'uploads/' }))
  @Post('/upload-image')
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

    return profileImage.key;
  }

  @Get('/recommendations')
  async findRecommendationsByUserId(
    @UserPayload('id', new ParseUUIDPipe()) userId: string
  ): Promise<PublicProfile[]> {
    const user = await this.userProfilesService.findOneUser(userId);
    const userProfile = await this.userProfilesService.findOneByUserId(userId);

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    const oneWeekAgo = moment().subtract(1, 'week');

    const currentRecommendedProfiles =
      await this.userProfilesService.findRecommendationsByUserId(userId);

    const oneOfCurrentRecommendedProfilesIsNotAvailable =
      currentRecommendedProfiles.some((recommendedProfile) => {
        return !recommendedProfile?.recUser?.userProfile?.isAvailable;
      });

    if (
      !userProfile.lastRecommendationsDate ||
      moment(userProfile.lastRecommendationsDate).isBefore(oneWeekAgo) ||
      currentRecommendedProfiles.length < 3 ||
      oneOfCurrentRecommendedProfilesIsNotAvailable
    ) {
      await this.userProfilesService.removeRecommendationsByUserId(userId);
      await this.userProfilesService.updateRecommendationsByUserId(userId);
      await this.userProfilesService.updateByUserId(userId, {
        lastRecommendationsDate: moment().toDate(),
      });
    }

    const recommendedProfiles =
      await this.userProfilesService.findRecommendationsByUserId(userId);

    return Promise.all(
      recommendedProfiles.map(
        async (recommendedProfile): Promise<PublicProfile> => {
          const averageDelayResponse =
            await this.userProfilesService.getAverageDelayResponse(
              recommendedProfile.recUser.id
            );

          const {
            recUser: { userProfile, ...restRecommendedUser },
          }: UserProfileRecommendation = recommendedProfile.toJSON();

          return {
            ...restRecommendedUser,
            ...userProfile,
            id: recommendedProfile.recUser.id,
            averageDelayResponse,
          };
        }
      )
    );
  }

  @Get('/:userId')
  async findByUserId(
    @Param('userId', new ParseUUIDPipe()) userIdToGet: string
  ) {
    const user = await this.userProfilesService.findOneUser(userIdToGet);
    const userProfile = await this.userProfilesService.findOneByUserId(
      userIdToGet,
      true
    );

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    if (user.role === UserRoles.ADMIN) {
      throw new BadRequestException();
    }

    const averageDelayResponse =
      await this.userProfilesService.getAverageDelayResponse(userIdToGet);

    return getPublicProfileFromUserAndUserProfile({
      user,
      userProfile,
      averageDelayResponse,
    });
  }
}
