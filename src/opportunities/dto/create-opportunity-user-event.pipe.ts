/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOpportunityUserEventDto } from './create-opportunity-user-event.dto';

export class CreateOpportunityUserEventPipe
  implements
    PipeTransform<
      CreateOpportunityUserEventDto,
      Promise<CreateOpportunityUserEventDto>
    >
{
  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  async transform(
    value: CreateOpportunityUserEventDto,
    { metatype }: ArgumentMetadata
  ): Promise<CreateOpportunityUserEventDto> {
    if (!metatype || !CreateOpportunityUserEventPipe.toValidate(metatype)) {
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
