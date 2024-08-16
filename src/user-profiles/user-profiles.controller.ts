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
  CandidateUserRoles,
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

  @Post('/:userId/abuse')
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

  @UserPermissions(Permissions.CANDIDATE, Permissions.RESTRICTED_COACH)
  @UseGuards(UserPermissionsGuard)
  @Self('params.userId')
  @UseGuards(SelfGuard)
  @Get('/recommendations/:userId')
  async findRecommendationsByUserId(
    @Param('userId', new ParseUUIDPipe()) userId: string
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
        return !recommendedProfile?.recommendedUser?.userProfile?.isAvailable;
      });

    if (
      !userProfile.lastRecommendationsDate ||
      moment(userProfile.lastRecommendationsDate).isBefore(oneWeekAgo) ||
      currentRecommendedProfiles.length <= 3 ||
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
          const lastSentMessage = await this.userProfilesService.getLastContact(
            userId,
            recommendedProfile.recommendedUser.id
          );
          const lastReceivedMessage =
            await this.userProfilesService.getLastContact(
              recommendedProfile.recommendedUser.id,
              userId
            );

          const {
            recommendedUser: { userProfile, ...restRecommendedUser },
          }: UserProfileRecommendation = recommendedProfile.toJSON();

          return {
            ...restRecommendedUser,
            ...userProfile,
            lastSentMessage: lastSentMessage?.createdAt || null,
            lastReceivedMessage: lastReceivedMessage?.createdAt || null,
          };
        }
      )
    );
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

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    if (user.role === UserRoles.ADMIN) {
      throw new BadRequestException();
    }

    const lastSentMessage = await this.userProfilesService.getLastContact(
      currentUserId,
      userIdToGet
    );
    const lastReceivedMessage = await this.userProfilesService.getLastContact(
      userIdToGet,
      currentUserId
    );

    if (isRoleIncluded(CandidateUserRoles, user.role)) {
      const userCandidate =
        await this.userProfilesService.findUserCandidateByCandidateId(
          userIdToGet
        );

      if (!userCandidate.hidden) {
        return getPublicProfileFromUserAndUserProfile(
          user,
          userProfile,
          lastSentMessage?.createdAt,
          lastReceivedMessage?.createdAt,
          userCandidate.url
        );
      }
    }

    return getPublicProfileFromUserAndUserProfile(
      user,
      userProfile,
      lastSentMessage?.createdAt,
      lastReceivedMessage?.createdAt
    );
  }
}
