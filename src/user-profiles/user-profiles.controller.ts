import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  InternalServerErrorException,
  Logger,
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
import { RecommendationsPageDto } from './recommendations/dto/recommendations.dto';
import {
  APPEND_BATCH_SIZE,
  UserProfileRecommendationsService,
} from './recommendations/user-profile-recommendations-ai.service';
import { UserProfilesService } from './user-profiles.service';
import { ContactTypeEnum } from './user-profiles.types';

@ApiTags('UserProfiles')
@ApiBearerAuth()
@Controller('user/profile')
export class UserProfilesController {
  private readonly logger = new Logger(UserProfilesController.name);

  // Trigger background refill when the user has consumed this fraction of stored results.
  private readonly RECOMMENDATION_REFILL_THRESHOLD = 0.8;

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
      this.logger.warn(`User not found: ${userId}`);
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
      this.logger.warn(
        `User not found: reported=${userId}, reporter=${currentUserId}`
      );
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
    isAvailableQuery?: string,
    @Query('sort')
    sort?: string
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

    const isAvailable =
      isAvailableQuery === 'true'
        ? true
        : isAvailableQuery === 'false'
        ? false
        : undefined;

    const filters = {
      role,
      offset,
      limit,
      search,
      nudgeIds,
      departments,
      businessSectorIds,
      contactTypes,
      isAvailable,
    };

    try {
      if (sort === 'relevance') {
        return this.userProfilesService.findAllByRelevance(filters, userId);
      }
      return this.userProfilesService.findAll(filters);
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
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor', new DefaultValuePipe(0), ParseIntPipe) cursor: number
  ): Promise<RecommendationsPageDto> {
    const user = await this.userProfilesService.findOneUser(userId);
    const userProfile = await this.userProfilesService.findOneByUserId(userId);

    if (!user || !userProfile) {
      throw new NotFoundException();
    }

    // Ensure a fresh pool exists (recomputes if stale/empty/legacy).
    await this.userProfileRecommendationsService.ensureFreshPool(
      user,
      userProfile
    );

    // Fetch one extra item to detect if there are more results beyond this page.
    const rows =
      await this.userProfileRecommendationsService.findRecommendationsByUserId(
        userId,
        { limit: limit + 1, cursor }
      );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const lastRank = page.length > 0 ? page[page.length - 1].rank : null;
    const nextCursor = hasMore ? lastRank : null;

    // Trigger background refill when the user is nearing the end of the stored pool.
    const storedCount =
      await this.userProfileRecommendationsService.countRecommendationsByUserId(
        userId
      );
    if (cursor + limit >= storedCount * this.RECOMMENDATION_REFILL_THRESHOLD) {
      this.userProfileRecommendationsService
        .appendRecommendationsForUserId(userId, APPEND_BATCH_SIZE)
        .catch((err) =>
          this.logger.error(`Recommendation refill failed for ${userId}:`, err)
        );
    }

    const recommendations = page.map((recoProfile) => {
      const publicProfile = generatePublicProfileDto(
        recoProfile.recUser,
        recoProfile.recUser.userProfile,
        null
      );
      if (!publicProfile) {
        throw new InternalServerErrorException(
          `Failed to generate public profile for user ${recoProfile.recUser.id}`
        );
      }
      return {
        id: recoProfile.id,
        publicProfile,
        reason: recoProfile.reason,
        profileScore: recoProfile.profileScore,
        needsScore: recoProfile.needsScore,
        activityScore: recoProfile.activityScore,
        locationCompatibilityScore: recoProfile.locationCompatibilityScore,
        finalScore: recoProfile.finalScore,
      };
    });

    return { recommendations, nextCursor };
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

    const usersStats = await this.userProfilesService.getUsersStats(
      user.id,
      user.role
    );

    return generatePublicProfileDto(user, userProfile, usersStats);
  }
}
