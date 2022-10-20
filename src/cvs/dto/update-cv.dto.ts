import { PartialType } from '@nestjs/swagger';
import { CreateCVDto } from './create-cv.dto';

export class UpdateCVDto extends PartialType(CreateCVDto) {}
