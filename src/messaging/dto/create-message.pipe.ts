/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMessageDto } from './create-message.dto';

@Injectable()
export class CreateMessagePipe
  implements PipeTransform<CreateMessageDto, Promise<CreateMessageDto>>
{
  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  async transform(
    value: CreateMessageDto,
    { metatype }: ArgumentMetadata
  ): Promise<CreateMessageDto> {
    if (!metatype || !CreateMessagePipe.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      console.error('Validation errors in CreateMessagePipe:', errors);
      throw new BadRequestException();
    }
    return value;
  }
}
