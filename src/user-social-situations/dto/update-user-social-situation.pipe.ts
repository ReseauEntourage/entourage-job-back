/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserSocialSituationDto } from './update-user-social-situation.dto';

export class UpdateUserSocialSituationPipe
  implements
    PipeTransform<
      UpdateUserSocialSituationDto,
      Promise<UpdateUserSocialSituationDto>
    >
{
  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  async transform(
    value: UpdateUserSocialSituationDto,
    { metatype }: ArgumentMetadata
  ): Promise<UpdateUserSocialSituationDto> {
    if (!metatype || !UpdateUserSocialSituationPipe.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException();
    }
    return value;
  }
}
