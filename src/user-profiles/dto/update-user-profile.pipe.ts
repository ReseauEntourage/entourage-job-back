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
import { Permissions } from 'src/users/users.types';
import { hasPermission } from 'src/users/users.utils';
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

    if (value.linkedinUrl?.length === 0) {
      value.linkedinUrl = null;
    }

    const { role } = this.request.user;

    if (hasPermission(Permissions.CANDIDATE, role)) {
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

    if (hasPermission(Permissions.RESTRICTED_COACH, role)) {
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
