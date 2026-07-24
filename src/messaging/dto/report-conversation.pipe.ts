import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
  type Type,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReportConversationDto } from './report-conversation.dto';

export class ReportAbusePipe implements PipeTransform<
  ReportConversationDto,
  Promise<ReportConversationDto>
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
    value: ReportConversationDto,
    { metatype }: ArgumentMetadata
  ): Promise<ReportConversationDto> {
    if (!metatype || !ReportAbusePipe.toValidate(metatype)) {
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
