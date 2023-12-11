/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  Inject,
  Injectable,
  PipeTransform,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CandidateUserRoles, CoachUserRoles } from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { RequestWithUser } from 'src/utils/types';
import { UpdateCandidateUserProfileDto } from './update-candidate-user-profile.dto';
import { UpdateCoachUserProfileDto } from './update-coach-user-profile.dto';

@Injectable({ scope: Scope.REQUEST })
export class UpdateUserProfilePipe
  implements
    PipeTransform<
      UpdateCandidateUserProfileDto | UpdateCoachUserProfileDto,
      Promise<UpdateCandidateUserProfileDto | UpdateCoachUserProfileDto>
    >
{
  constructor(@Inject(REQUEST) private request: RequestWithUser) {}

  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array];
    return !types.includes(metatype);
  }

  async transform(
    value: UpdateCandidateUserProfileDto | UpdateCoachUserProfileDto,
    { metatype }: ArgumentMetadata
  ): Promise<UpdateCandidateUserProfileDto | UpdateCoachUserProfileDto> {
    if (!metatype || !UpdateUserProfilePipe.toValidate(metatype)) {
      return value;
    }

    const { role } = this.request.user;

    if (isRoleIncluded(CandidateUserRoles, role)) {
      const object = plainToInstance(UpdateCandidateUserProfileDto, value);
      const errors = await validate(object, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      });

      if (errors.length > 0) {
        throw new BadRequestException();
      }
    }

    if (isRoleIncluded(CoachUserRoles, role)) {
      const object = plainToInstance(UpdateCoachUserProfileDto, value);
      const errors = await validate(object, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
      });

      if (errors.length > 0) {
        throw new BadRequestException();
      }
    }

    return value;
  }
}
