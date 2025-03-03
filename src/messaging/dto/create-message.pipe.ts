/* eslint-disable @typescript-eslint/ban-types */
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { CreateMessageDto } from './create-message.dto';

@Injectable()
export class CreateMessagePipe
  implements PipeTransform<string, CreateMessageDto>
{
  transform(value: string): CreateMessageDto {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        throw new BadRequestException();
      }
    }
    return value;
  }
}

// export class CreateMessagePipe
//   implements PipeTransform<CreateMessageDto, Promise<CreateMessageDto>>
// {
//   private static toValidate(metatype: Function): boolean {
//     const types: Function[] = [String, Boolean, Number, Array, Object];
//     return !types.includes(metatype);
//   }

//   async transform(
//     value: CreateMessageDto,
//     { metatype }: ArgumentMetadata
//   ): Promise<CreateMessageDto> {
//     if (!metatype || !CreateMessagePipe.toValidate(metatype)) {
//       return value;
//     }
//     const object = plainToInstance(metatype, value);
//     const errors = await validate(object, {
//       whitelist: true,
//       forbidNonWhitelisted: true,
//       forbidUnknownValues: true,
//       skipMissingProperties: true,
//     });

//     if (errors.length > 0) {
//       throw new BadRequestException();
//     }
//     return value;
//   }
// }
