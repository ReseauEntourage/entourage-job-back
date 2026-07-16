import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
  type Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ContactUsFormDto } from './contact-us-form.dto';

export class ContactUsFormPipe
  implements PipeTransform<ContactUsFormDto, Promise<ContactUsFormDto>>
{
  async transform(
    value: ContactUsFormDto,
    { metatype }: ArgumentMetadata
  ): Promise<ContactUsFormDto> {
    if (!metatype || !ContactUsFormPipe.toValidate(metatype)) {
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

  private static toValidate(metatype: Type<unknown>): boolean {
    const types: Array<Type<unknown>> = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return !types.includes(metatype);
  }
}
