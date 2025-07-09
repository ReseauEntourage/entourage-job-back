import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import validator from 'validator';
import { Public } from 'src/auth/guards';
import { PublicProfilesService } from './public-profiles.services';

@ApiTags('PublicProfiles')
@ApiBearerAuth()
@Controller('users/public-profiles')
export class PublicProfilesController {
  constructor(private readonly publicProfilesService: PublicProfilesService) {}

  @Public()
  @Get()
  async getPublicProfiles(
    @Query()
    query: {
      limit: number;
      offset: number;
      search: string;
    }
  ) {
    return this.publicProfilesService.getPublicProfiles(query);
  }

  @Public()
  @Get(':candidateId')
  async getPublicProfileByCandidateId(
    @Param('candidateId') candidateId: string
  ) {
    const candidateIdIsValid = validator.isUUID(candidateId, 4);
    if (!candidateIdIsValid) {
      throw new NotFoundException('Invalid candidate ID format');
    }
    const publicProfile =
      await this.publicProfilesService.getPublicProfileByCandidateId(
        candidateId
      );
    if (!publicProfile) {
      throw new NotFoundException('Public profile not found');
    }
    return publicProfile;
  }
}
