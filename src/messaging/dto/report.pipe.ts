/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReportDto } from './report.dto';

export class ReportAbusePipe
  implements PipeTransform<ReportDto, Promise<ReportDto>>
{
  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  async transform(
    value: ReportDto,
    { metatype }: ArgumentMetadata
  ): Promise<ReportDto> {
    if (!metatype || !ReportAbusePipe.toValidate(metatype)) {
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
