import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PostReactionEmojis } from 'src/posts/models';
import { PostDeletionReasons, PostTitleSources } from 'src/posts/posts.types';
import { ReportContentDto } from 'src/reports/dto';
import { trimString } from 'src/utils/transforms';

export const DISCUSSION_TITLE_MAX_LENGTH = 120;
export const MESSAGE_MAX_LENGTH = 5000;
export const DELETION_COMMENT_MAX_LENGTH = 500;
// "Proposer un autre titre" is limited to 5 by the front: 5 previous titles
// at most, plus the first one
export const PREVIOUS_TITLES_MAX = 6;

export class CreateDiscussionDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(DISCUSSION_TITLE_MAX_LENGTH)
  title: string;

  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_MAX_LENGTH)
  content: string;

  @ApiPropertyOptional({ enum: Object.values(PostTitleSources) })
  @IsOptional()
  @IsIn(Object.values(PostTitleSources))
  titleSource?: (typeof PostTitleSources)[keyof typeof PostTitleSources];

  // Explicit acceptance of the help groups charter, at the first publication
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptCharter?: boolean;
}

export class CreateReplyDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_MAX_LENGTH)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptCharter?: boolean;
}

export class UpdateDiscussionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(DISCUSSION_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_MAX_LENGTH)
  content?: string;
}

export class UpdateReplyDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_MAX_LENGTH)
  content: string;
}

export class TitleSuggestionDto {
  @ApiProperty()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(MESSAGE_MAX_LENGTH)
  content: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PREVIOUS_TITLES_MAX)
  @IsString({ each: true })
  @MaxLength(DISCUSSION_TITLE_MAX_LENGTH, { each: true })
  previousTitles?: string[];
}

/**
 * Reacted message: exactly one of the discussion or one of its replies
 * (checked by the service).
 */
export class ReactionTargetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(4)
  discussionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID(4)
  replyId?: string;
}

export class RemoveReactionDto {
  @ApiProperty({ type: ReactionTargetDto })
  @ValidateNested()
  @Type(() => ReactionTargetDto)
  target: ReactionTargetDto;
}

export class SetReactionDto extends RemoveReactionDto {
  @ApiProperty({ enum: PostReactionEmojis })
  @IsIn(PostReactionEmojis)
  emoji: (typeof PostReactionEmojis)[number];
}

export class ModerationDeleteDto {
  @ApiProperty({ enum: Object.values(PostDeletionReasons) })
  @IsIn(Object.values(PostDeletionReasons))
  reason: (typeof PostDeletionReasons)[keyof typeof PostDeletionReasons];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(DELETION_COMMENT_MAX_LENGTH)
  comment?: string;
}

/**
 * Report of the discussion or of one of its replies (exactly one target,
 * checked by the service), with the motive and optional comment shared by
 * every report.
 */
export class ReportMessageDto extends IntersectionType(
  RemoveReactionDto,
  ReportContentDto
) {}

export class UpdateMembershipDto {
  @ApiProperty()
  @IsBoolean()
  emailsEnabled: boolean;
}
