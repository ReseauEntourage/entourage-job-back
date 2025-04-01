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
