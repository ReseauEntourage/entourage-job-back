import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
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
import { generatePublicProfileDto } from './dto/public-profile.dto';
import { ReportAbuseUserProfileDto } from './dto/report-abuse-user-profile.dto';
import { ReportAbuseUserProfilePipe } from './dto/report-abuse-user-profile.pipe';
import { UpdateCandidateUserProfileDto } from './dto/update-candidate-user-profile.dto';
import { UpdateUserProfilePipe } from './dto/update-user-profile.pipe';
import { generateUserProfileDto } from './dto/user-profile.dto';
import { RecommendationsDto } from './recommendations/dto/recommendations.dto';
import { UserProfileRecommendationsService } from './recommendations/user-profile-recommendations-ai.service';
import { UserProfilesService } from './user-profiles.service';
import { ContactTypeEnum } from './user-profiles.types';

@ApiTags('UserProfiles')
@ApiBearerAuth()
@Controller('user/profile')
export class UserProfilesController {
  constructor(
    private readonly userProfilesService: UserProfilesService,
    private readonly userProfileRecommendationsService: UserProfileRecommendationsService
  ) {}

  @ApiBearerAuth()
  @Get('/completion')
  async getProfileCompletion(
    @UserPayload('id', new ParseUUIDPipe()) id: string
  ) {
    return await this.userProfilesService.calculateProfileCompletion(id);
  }

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
    contactTypes: ContactTypeEnum[],
    @Query('isAvailable')
    isAvailableQuery?: string
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
      return this.userProfilesService.findAll({
        role,
        offset,
        limit,
        search,
        nudgeIds,
        departments,
        businessSectorIds,
        contactTypes,
        isAvailable: isAvailableQuery === 'true' ? true : undefined,
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
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
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
  ): Promise<RecommendationsDto> {
    const user = await this.userProfilesService.findOneUser(userId);
    const userProfile = await this.userProfilesService.findOneByUserId(userId);

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    return this.userProfileRecommendationsService.retrieveOrComputeRecommendationsForUserIdIA(
      user,
      userProfile,
      3
    );
  }

  // Only for admin users to get recommendations for any user, not only themselves
  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Get('/recommendations-ai/:userId')
  async findRecommendationsWithAIByUserId(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query('forceRefresh') forceRefresh: string,
    // Default pool size to 3 if not provided, and parse it to an integer
    @Query('poolSize', new DefaultValuePipe(3), ParseIntPipe) poolSize: number
  ) {
    const user = await this.userProfilesService.findOneUser(userId);
    const userProfile = await this.userProfilesService.findOneByUserId(userId);

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    if (forceRefresh === 'true') {
      await this.userProfileRecommendationsService.removeRecommendationsByUserId(
        userId
      );
    }

    return this.userProfileRecommendationsService.retrieveOrComputeRecommendationsForUserIdIA(
      user,
      userProfile,
      poolSize || 3
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

    const averageDelayResponse =
      await this.userProfilesService.getAverageDelayResponse(userIdToGet);

    return generatePublicProfileDto(user, userProfile, averageDelayResponse);
  }
}
