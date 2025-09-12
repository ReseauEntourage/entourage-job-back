/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserRegistrationDto } from './create-user-registration.dto';

export class CreateUserRegistrationPipe
  implements
    PipeTransform<
      CreateUserRegistrationDto,
      Promise<CreateUserRegistrationDto>
    >
{
  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  async transform(
    value: CreateUserRegistrationDto,
    { metatype }: ArgumentMetadata
  ): Promise<CreateUserRegistrationDto> {
    if (!metatype || !CreateUserRegistrationPipe.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      console.error('Validation errors:', errors);
      throw new BadRequestException();
    }
    return value;
  }
}
