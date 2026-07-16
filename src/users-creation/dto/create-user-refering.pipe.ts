import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
  type Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserReferingDto } from './create-user-refering.dto';

export class CreateUserReferingPipe
  implements
    PipeTransform<CreateUserReferingDto, Promise<CreateUserReferingDto>>
{
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

  async transform(
    value: CreateUserReferingDto,
    { metatype }: ArgumentMetadata
  ): Promise<CreateUserReferingDto> {
    if (!metatype || !CreateUserReferingPipe.toValidate(metatype)) {
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
