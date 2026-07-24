import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
  type Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCompanyDto } from './create-company.dto';

export class CreateCompanyPipe implements PipeTransform<
  CreateCompanyDto,
  Promise<CreateCompanyDto>
> {
  async transform(
    value: CreateCompanyDto,
    { metatype }: ArgumentMetadata
  ): Promise<CreateCompanyDto> {
    if (!metatype || !CreateCompanyPipe.toValidate(metatype)) {
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
