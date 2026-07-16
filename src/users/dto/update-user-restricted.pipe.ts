import {
  ArgumentMetadata,
  BadRequestException,
  Inject,
  Injectable,
  PipeTransform,
  Scope,
  type Type,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Permissions } from '../users.types';
import { hasPermission } from '../users.utils';
import type { RequestWithUser } from 'src/utils/types';
import { UpdateUserAdminDto } from './update-user-admin.dto';
import { UpdateUserRestrictedDto } from './update-user-restricted.dto';

@Injectable({ scope: Scope.REQUEST })
export class UpdateUserRestrictedPipe
  implements
    PipeTransform<UpdateUserRestrictedDto, Promise<UpdateUserRestrictedDto>>
{
  constructor(@Inject(REQUEST) private request: RequestWithUser) {}

  async transform(
    value: UpdateUserRestrictedDto,
    { metatype }: ArgumentMetadata
  ): Promise<UpdateUserRestrictedDto> {
    if (!metatype || !UpdateUserRestrictedPipe.toValidate(metatype)) {
      return value;
    }

    const { role } = this.request.user;

    // Les admins peuvent modifier des champs hors du DTO restreint (ex. role, zone,
    // OrganizationId depuis le backoffice) : on les valide contre le DTO admin
    // au lieu d'ignorer les erreurs de validation.
    const dtoType = hasPermission(Permissions.ADMIN, role)
      ? UpdateUserAdminDto
      : metatype;

    const object = plainToInstance(dtoType, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException();
    }
    return object;
  }

  private static toValidate(metatype: Type<unknown>): boolean {
    const types: Array<Type<unknown>> = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return !types.includes(metatype);
  }
}
