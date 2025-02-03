import {
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Self,
  SelfGuard,
  UserPermissions,
  UserPermissionsGuard,
} from 'src/users/guards';
import { Permissions } from 'src/users/users.types';
import { UpdateUserSocialSituationDto } from './dto/update-user-social-situation.dto';
import { UpdateUserSocialSituationPipe } from './dto/update-user-social-situation.pipe';
import { UserSocialSituationsService } from './user-social-situations.service';

@ApiTags('UserSocialSituations')
@ApiBearerAuth()
@Controller('users/social-situations')
export class UserSocialSituationsController {
  constructor(
    private readonly userSocialSituationsService: UserSocialSituationsService
  ) {}

  @UserPermissions(Permissions.CANDIDATE)
  @UseGuards(UserPermissionsGuard)
  @Self('params.candidateId')
  @UseGuards(SelfGuard)
  @Put('/:candidateId')
  async updateByUserId(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Body(UpdateUserSocialSituationPipe)
    updateUserSocialSituationDto: UpdateUserSocialSituationDto
  ) {
    const user =
      this.userSocialSituationsService.findOneByCandidateId(candidateId);

    if (!user) {
      throw new NotFoundException();
    }

    const updatedUserSocialSituation =
      await this.userSocialSituationsService.createOrUpdateSocialSituation(
        candidateId,
        updateUserSocialSituationDto
      );

    if (!updatedUserSocialSituation) {
      throw new NotFoundException();
    }

    return updatedUserSocialSituation;
  }
}
