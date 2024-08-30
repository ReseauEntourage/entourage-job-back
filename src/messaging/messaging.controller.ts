import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { CreateMessagePipe, CreateMessageDto } from './dto';
import { ReportAbuseDto } from './dto/report-abuse.dto';
import { ReportAbusePipe } from './dto/report-abuse.pipe';
import { MessagingService } from './messaging.service';

@ApiBearerAuth()
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  async getConversations(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Query('query') query?: string
  ) {
    return this.messagingService.getConversationsForUser(userId, query);
  }

  // Can only fetch the conversation if the user is a participant
  @Get('conversations/:conversationId')
  async getConversation(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string
  ) {
    return this.messagingService.getConversationForUser(conversationId, userId);
  }

  @Post('messages')
  async createInternalMessage(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Body(new CreateMessagePipe())
    createMessageDto: CreateMessageDto
  ) {
    // Create the conversation if needed
    if (!createMessageDto.conversationId && createMessageDto.participantIds) {
      const participants = [...createMessageDto.participantIds];
      // Add the current user to the participants
      participants.push(userId);

      const conversation = await this.messagingService.createConversation(
        participants
      );
      createMessageDto.conversationId = conversation.id;
    }
    delete createMessageDto.participantIds;
    try {
      // Remove the participantIds property
      const createdMessage = await this.messagingService.createMessage({
        authorId: userId,
        // Add createMessageDto properties without participantIds
        ...createMessageDto,
      });
      return createdMessage;
    } catch (error) {
      console.error(error);
    }
  }

  @Post('conversation/:conversationId/report')
  async reportMessageAbuse(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body(new ReportAbusePipe())
    reportAbuseDto: ReportAbuseDto
  ) {
    return this.messagingService.reportConversation(
      conversationId,
      reportAbuseDto.reason,
      userId
    );
  }
}
