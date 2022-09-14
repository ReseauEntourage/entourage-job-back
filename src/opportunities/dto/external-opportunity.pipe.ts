/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateExternalOpportunityDto } from './create-external-opportunity.dto';

export class ExternalOpportunityPipe
  implements
    PipeTransform<
      CreateExternalOpportunityDto,
      Promise<CreateExternalOpportunityDto>
    >
{
  async transform(
    value: CreateExternalOpportunityDto,
    { metatype }: ArgumentMetadata
  ): Promise<CreateExternalOpportunityDto> {
    if (!metatype || !ExternalOpportunityPipe.toValidate(metatype)) {
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
