/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EventParticipationDto } from './event-participation.dto';

export class EventParticipationPipe
  implements
    PipeTransform<EventParticipationDto, Promise<EventParticipationDto>>
{
  async transform(
    value: EventParticipationDto,
    { metatype }: ArgumentMetadata
  ): Promise<EventParticipationDto> {
    if (!metatype || !EventParticipationPipe.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      console.error('Validation failed:', errors);
      throw new BadRequestException();
    }
    return value;
  }

  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
