/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiStreamDto } from './ai-stream.dto';

export class AiStreamPipe
  implements PipeTransform<AiStreamDto, Promise<AiStreamDto>>
{
  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  async transform(
    value: AiStreamDto,
    { metatype }: ArgumentMetadata
  ): Promise<AiStreamDto> {
    if (!metatype || !AiStreamPipe.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      skipMissingProperties: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException();
    }
    return value;
  }
}
