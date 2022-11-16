/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ContactCompanyFormDto } from './contact-company-form.dto';

export class ContactCompanyFormPipe
  implements
    PipeTransform<ContactCompanyFormDto, Promise<ContactCompanyFormDto>>
{
  async transform(
    value: ContactCompanyFormDto,
    { metatype }: ArgumentMetadata
  ): Promise<ContactCompanyFormDto> {
    if (!metatype || !ContactCompanyFormPipe.toValidate(metatype)) {
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
