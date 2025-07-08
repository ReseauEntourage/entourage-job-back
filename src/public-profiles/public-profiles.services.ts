import { Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { FilterParams } from 'src/utils/types';
import { PublicProfileFilterKey } from './public-profiles.types';

@Injectable()
export class PublicProfilesService {
  constructor(private usersService: UsersService) {}

  async getPublicProfiles(
    query: {
      limit: number;
      offset: number;
      search: string;
    } & FilterParams<PublicProfileFilterKey>
  ) {
    return this.usersService.findAllPublicProfiles(query);
  }

  getPublicProfileByCandidateId(candidateId: string) {
    return this.usersService.findPublicProfileByCandidateId(candidateId);
  }
}
