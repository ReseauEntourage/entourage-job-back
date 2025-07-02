import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
    return this.publicProfilesService.getPublicProfileByCandidateId(
      candidateId
    );
  }
}
