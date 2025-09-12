import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray } from 'class-validator';

export class InviteCollaboratorsDto {
  @ApiProperty()
  @IsArray()
  @ArrayMaxSize(100)
  emails: string[];
}
