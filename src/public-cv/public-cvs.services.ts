import { Injectable, NotFoundException } from '@nestjs/common';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { FilterParams } from 'src/utils/types';
import { generatePublicCVDto, PublicCVDto } from './dto/public-cv.dto';
import { PublicCVsFilterKey } from './public-cvs.types';

@Injectable()
export class PublicCVsService {
  constructor(
    private usersService: UsersService,
    private userProfilesService: UserProfilesService
  ) {}

  async getPublicCVs(
    query: {
      limit: number;
      offset: number;
      search: string;
    } & FilterParams<PublicCVsFilterKey>
  ) {
    return this.usersService.findAllPublicCVs(query);
  }

  async getPublicCVByUserId(userId: string): Promise<PublicCVDto> {
    // Fetch the user by ID
    const user = await this.findOneUser(userId);
    if (user.role !== UserRoles.CANDIDATE) {
      throw new NotFoundException(
        "Can't fetch public CV for non-candidate user"
      );
    }

    // Fetch the complete user profile
    const userProfile = await this.userProfilesService.findOneByUserId(
      user.id,
      true
    );

    // Return the public CV DTO
    return generatePublicCVDto(user, userProfile);
  }

  /**
   * Private methods
   */
  private async findOneUser(userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
