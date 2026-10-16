import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

// A page of messages displayed at once
export const SEEN_MESSAGE_IDS_MAX = 100;

/**
 * Ids of the messages (a discussion message or replies) actually displayed
 * on the screen of the recipient: they cover the events announcing them
 * (a reply) or the events about them (reactions to the message).
 */
export class MarkNotificationsSeenDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SEEN_MESSAGE_IDS_MAX)
  @IsUUID(4, { each: true })
  messageIds: string[];
}
