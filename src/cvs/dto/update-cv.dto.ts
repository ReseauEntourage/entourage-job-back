import { PartialType } from '@nestjs/mapped-types';
import { CreateCVDto } from './create-cv.dto';

export class UpdateCVDto extends PartialType(CreateCVDto) {}
