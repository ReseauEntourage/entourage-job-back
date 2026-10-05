import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// At least one non whitespace character
const NOT_BLANK = /\S/;

export const HELP_GROUP_NAME_MAX_LENGTH = 80;
export const HELP_GROUP_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Plain text fields (line breaks kept, markup stored as is and never
 * interpreted).
 */
export class CreateHelpGroupDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @Matches(NOT_BLANK, { message: 'name must not be blank' })
  @MaxLength(HELP_GROUP_NAME_MAX_LENGTH)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @Matches(NOT_BLANK, { message: 'description must not be blank' })
  @MaxLength(HELP_GROUP_DESCRIPTION_MAX_LENGTH)
  description: string;
}

export class UpdateHelpGroupDto extends CreateHelpGroupDto {}
