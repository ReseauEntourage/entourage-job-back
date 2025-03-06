import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  IsUUID,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { ConversationParticipant } from './conversation-participant.model';

@Table({ tableName: 'ConversationFeedback' })
export class ConversationFeedback extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column
  id: string;

  @ApiProperty()
  @IsString()
  @IsUUID(4)
  @ForeignKey(() => ConversationParticipant)
  @AllowNull(false)
  @Column
  conversationParticipantId: string;

  @ApiProperty()
  @IsNumber()
  @AllowNull(true)
  @Column
  rating: number;

  @CreatedAt
  createdAt: Date;

  // @BelongsTo(() => ConversationParticipant, 'conversationParticipantId')
  // participant: ConversationParticipant;
}
