/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InscriptionCandidateFormDto } from './inscription-candidate-form.dto';

export class InscriptionCandidateFormPipe
  implements
    PipeTransform<
      InscriptionCandidateFormDto,
      Promise<InscriptionCandidateFormDto>
    >
{
  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  async transform(
    value: InscriptionCandidateFormDto,
    { metatype }: ArgumentMetadata
  ): Promise<InscriptionCandidateFormDto> {
    if (!metatype || !InscriptionCandidateFormPipe.toValidate(metatype)) {
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
