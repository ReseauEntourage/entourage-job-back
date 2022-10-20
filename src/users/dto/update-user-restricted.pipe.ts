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
import { UserRoles } from 'src/users/users.types';
import { RequestWithUser } from 'src/utils/types';
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
    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    const { role } = this.request.user;

    if (errors.length > 0 && role !== UserRoles.ADMIN) {
      throw new BadRequestException();
    }
    return value;
  }

  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
