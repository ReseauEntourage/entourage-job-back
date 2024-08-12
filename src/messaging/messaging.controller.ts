import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { CreateMessagePipe, CreateMessageDto } from './dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateConversationPipe } from './dto/create-conversation.pipe';
import { ReportAbuseDto } from './dto/report-abuse.dto';
import { ReportAbusePipe } from './dto/report-abuse.pipe';
import { MessagingService } from './messaging.service';

@ApiBearerAuth()
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('conversations')
  async createConversation(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Body(new CreateConversationPipe())
    createConversationDto: CreateConversationDto
  ) {
    const participants = [...createConversationDto.participantIds];
    // Add the current user to the conversation
    participants.push(userId);

    this.messagingService.createConversation(participants);
  }

  // Can only fetch the conversation if the user is a participant
  @Get('conversations/:conversationId')
  async getConversation(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string
  ) {
    return this.messagingService.getConversation(conversationId, userId);
  }

  @Post('messages')
  async createInternalMessage(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Body(new CreateMessagePipe())
    createMessageDto: CreateMessageDto
  ) {
    try {
      const createdMessage = await this.messagingService.createMessage({
        authorId: userId,
        ...createMessageDto,
      });
      return createdMessage;
    } catch (error) {
      console.error(error);
    }
  }

  @Post('messages/:messageId/report-abuse')
  async reportMessageAbuse(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @Body(new ReportAbusePipe())
    reportAbuseDto: ReportAbuseDto
  ) {
    return this.messagingService.reportMessageAbuse(
      messageId,
      reportAbuseDto.reason,
      userId
    );
  }
}
