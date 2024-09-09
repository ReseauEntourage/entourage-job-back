/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReportAbuseUserProfileDto } from './report-abuse-user-profile.dto';

export class ReportAbuseUserProfilePipe
  implements
    PipeTransform<
      ReportAbuseUserProfileDto,
      Promise<ReportAbuseUserProfileDto>
    >
{
  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  async transform(
    value: ReportAbuseUserProfileDto,
    { metatype }: ArgumentMetadata
  ): Promise<ReportAbuseUserProfileDto> {
    if (!metatype || !ReportAbuseUserProfilePipe.toValidate(metatype)) {
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
