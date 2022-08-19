import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { CreateCVDto } from './create-cv.dto';

@Injectable()
export class ParseCVPipe implements PipeTransform<string, CreateCVDto> {
  transform(value: string): CreateCVDto {
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
