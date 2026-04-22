import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  generateStaffContactDto,
  StaffContactDto,
} from 'src/auth/dto/staff-contact.dto';
import { ProfileGenerationService } from 'src/profile-generation/profile-generation.service';
import { SessionsService } from 'src/sessions/sessions.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UsersService } from 'src/users/users.service';
import { UserRole } from 'src/users/users.types';
import { UsersStatsService } from 'src/users-stats/users-stats.service';
import {
  generateCurrentUserAchievementsDto,
  CurrentUserAchievementsDto,
} from './dto/current-user-achievements.dto';
import {
  generateCurrentUserCompanyDto,
  CurrentUserCompanyDto,
} from './dto/current-user-company.dto';
import {
  generateCurrentUserIdentityDto,
  CurrentUserIdentityDto,
  CurrentUserIdentityAttributes,
} from './dto/current-user-identity.dto';
import {
  generateCurrentUserOrganizationDto,
  CurrentUserOrganizationDto,
} from './dto/current-user-organization.dto';
import {
  generateCurrentUserProfileDto,
  generateCurrentUserProfileCompleteDto,
  CurrentUserProfileDto,
  CurrentUserProfileCompleteDto,
} from './dto/current-user-profile.dto';
import {
  generateCurrentUserReadDocumentsDto,
  CurrentUserReadDocumentsDto,
} from './dto/current-user-read-documents.dto';
import {
  generateCurrentUserReferredUsersDto,
  CurrentUserReferredUsersDto,
} from './dto/current-user-referred-users.dto';
import {
  generateCurrentUserReferrerDto,
  CurrentUserReferrerDto,
} from './dto/current-user-referrer.dto';
import { CurrentUserStatsDto } from './dto/current-user-stats.dto';
import { CurrentUserWhatsappZoneDto } from './dto/current-user-whatsapp-zone.dto';

@Injectable()
export class CurrentUserService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => UserProfilesService))
    private readonly userProfilesService: UserProfilesService,
    private readonly profileGenerationService: ProfileGenerationService,
    @Inject(forwardRef(() => UsersStatsService))
    private readonly usersStatsService: UsersStatsService,
    private readonly sessionsService: SessionsService
  ) {}

  async getIdentity(userId: string): Promise<CurrentUserIdentityDto> {
    const user = await this.usersService.findOneWithAttributes(
      userId,
      CurrentUserIdentityAttributes
    );
    if (!user) {
      throw new NotFoundException();
    }
    await this.sessionsService.createOrUpdateSession(userId);
    return generateCurrentUserIdentityDto(user);
  }

  async getProfile(userId: string): Promise<CurrentUserProfileDto> {
    const userProfile = await this.userProfilesService.findOneByUserId(
      userId,
      false
    );
    if (!userProfile) {
      throw new NotFoundException();
    }
    return generateCurrentUserProfileDto(userProfile);
  }

  async getProfileComplete(
    userId: string
  ): Promise<CurrentUserProfileCompleteDto> {
    const userProfile = await this.userProfilesService.findOneByUserId(
      userId,
      true
    );
    if (!userProfile) {
      throw new NotFoundException();
    }
    const hasExtractedCvData =
      await this.profileGenerationService.hasExtractedCVData(userProfile.id);
    return generateCurrentUserProfileCompleteDto(
      userProfile,
      hasExtractedCvData
    );
  }

  async getCompany(userId: string): Promise<CurrentUserCompanyDto | null> {
    const user = await this.usersService.findOneWithCompanyOnly(userId);
    if (!user) {
      throw new NotFoundException();
    }
    return generateCurrentUserCompanyDto(user);
  }

  async getOrganization(
    userId: string
  ): Promise<CurrentUserOrganizationDto | null> {
    const user = await this.usersService.findOneWithOrganizationOnly(userId);
    if (!user) {
      throw new NotFoundException();
    }
    return generateCurrentUserOrganizationDto(user);
  }

  async getStats(
    userId: string,
    userRole: UserRole
  ): Promise<CurrentUserStatsDto> {
    const user = await this.usersService.findOne(userId);
    return {
      createdAt: user.createdAt,
      averageDelayResponse:
        await this.usersStatsService.getAverageDelayResponse(userId),
      responseRate: await this.usersStatsService.getResponseRate(userId),
      totalConversationWithMirrorRoleCount:
        await this.usersStatsService.getTotalConversationWithMirrorRoleCount(
          userId,
          userRole
        ),
    };
  }

  async getWhatsappZone(userId: string): Promise<CurrentUserWhatsappZoneDto> {
    const user = await this.usersService.findOneWithAttributes(userId, [
      'id',
      'whatsappZoneName',
      'whatsappZoneUrl',
      'whatsappZoneQR',
    ]);
    if (!user) {
      throw new NotFoundException();
    }
    return {
      name: user.whatsappZoneName || null,
      url: user.whatsappZoneUrl || null,
      qr: user.whatsappZoneQR || null,
    };
  }

  async getStaffContact(userId: string): Promise<StaffContactDto> {
    const user = await this.usersService.findOneWithRelations(userId);
    if (!user || !user.staffContact) {
      throw new NotFoundException();
    }
    return generateStaffContactDto(user.staffContact);
  }

  async getReferredUsers(userId: string): Promise<CurrentUserReferredUsersDto> {
    const user = await this.usersService.findOneWithReferredCandidatesOnly(
      userId
    );
    if (!user) {
      throw new NotFoundException();
    }
    return generateCurrentUserReferredUsersDto(user);
  }

  async getReferrer(userId: string): Promise<CurrentUserReferrerDto> {
    const user = await this.usersService.findOneWithRefererOnly(userId);
    if (!user) {
      throw new NotFoundException();
    }
    return generateCurrentUserReferrerDto(user);
  }

  async getAchievements(userId: string): Promise<CurrentUserAchievementsDto> {
    const user = await this.usersService.findOneWithAchievementsOnly(userId);
    if (!user) {
      throw new NotFoundException();
    }
    return generateCurrentUserAchievementsDto(user);
  }

  async getReadDocuments(userId: string): Promise<CurrentUserReadDocumentsDto> {
    const user = await this.usersService.findOneWithReadDocumentsOnly(userId);
    if (!user) {
      throw new NotFoundException();
    }
    return generateCurrentUserReadDocumentsDto(user);
  }
}
