/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOpportunityUserDto } from './update-opportunity-user.dto';

export class UpdateOpportunityUserPipe
  implements
    PipeTransform<UpdateOpportunityUserDto, Promise<UpdateOpportunityUserDto>>
{
  async transform(
    value: UpdateOpportunityUserDto,
    { metatype }: ArgumentMetadata
  ): Promise<UpdateOpportunityUserDto> {
    if (!metatype || !UpdateOpportunityUserPipe.toValidate(metatype)) {
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

  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
