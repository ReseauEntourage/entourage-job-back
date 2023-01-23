/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ContactCandidateFormDto } from './contact-candidate-form.dto';

export class ContactCandidateFormPipe
  implements
    PipeTransform<ContactCandidateFormDto, Promise<ContactCandidateFormDto>>
{
  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  async transform(
    value: ContactCandidateFormDto,
    { metatype }: ArgumentMetadata
  ): Promise<ContactCandidateFormDto> {
    if (!metatype || !ContactCandidateFormPipe.toValidate(metatype)) {
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
