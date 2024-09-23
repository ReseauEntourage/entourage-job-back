import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { CreateMessagePipe, CreateMessageDto } from './dto';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { ReportAbusePipe } from './dto/report-conversation.pipe';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging')
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
    await this.messagingService.setConversationHasSeen(conversationId, userId);
    return this.messagingService.getConversationForUser(conversationId, userId);
  }

  @Post('messages')
  async postMessage(
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
      return await this.messagingService.createMessage({
        authorId: userId,
        // Add createMessageDto properties without participantIds
        ...createMessageDto,
      });
    } catch (error) {
      console.error(error);
    }
  }

  @Post('conversations/:conversationId/report')
  async reportMessageAbuse(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Body(new ReportAbusePipe())
    reportConversationDto: ReportConversationDto
  ) {
    return this.messagingService.reportConversation(
      conversationId,
      reportConversationDto,
      userId
    );
  }
}
