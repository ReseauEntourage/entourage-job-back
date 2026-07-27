import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  type Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMailingListDto } from './create-mailing-list.dto';

@Injectable()
export class CreateMailingListPipe implements PipeTransform<
  CreateMailingListDto,
  Promise<CreateMailingListDto>
> {
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
    value: CreateMailingListDto,
    { metatype }: ArgumentMetadata
  ): Promise<CreateMailingListDto> {
    if (!metatype || !CreateMailingListPipe.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      console.error('Validation errors in CreateMailingListPipe:', errors);
      throw new BadRequestException();
    }
    return value;
  }
}
