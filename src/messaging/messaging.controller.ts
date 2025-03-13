import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { User } from 'src/users/models/user.model';
import {
  CreateMessagePipe,
  CreateMessageDto,
  PostFeedbackPipe,
  PostFeedbackDto,
} from './dto';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { ReportAbusePipe } from './dto/report-conversation.pipe';
import { CanParticipate } from './guards/can-participate.guard';
import { UserInConversation } from './guards/user-in-conversation';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  async getConversations(
    @UserPayload('id', new ParseUUIDPipe()) userId: string
  ) {
    return this.messagingService.getConversationsForUser(userId);
  }

  @Get('conversations/unseen-count')
  async getUnseenConversationsCount(
    @UserPayload('id', new ParseUUIDPipe()) userId: string
  ) {
    return this.messagingService.getUnseenConversationsCount(userId);
  }

  @UseGuards(UserInConversation)
  @Get('conversations/:conversationId')
  async getConversation(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string
  ) {
    await this.messagingService.setConversationHasSeen(conversationId, userId);
    return this.messagingService.getConversationById(conversationId, userId);
  }

  @Post('messages')
  @UseGuards(CanParticipate)
  async postMessage(
    @UserPayload() user: User,
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Body(new CreateMessagePipe())
    createMessageDto: CreateMessageDto
  ) {
    try {
      // Create the conversation if needed
      if (!createMessageDto.conversationId && createMessageDto.participantIds) {
        await this.messagingService.handleDailyConversationLimit(
          user,
          createMessageDto.content
        );
        const participants = [...createMessageDto.participantIds];
        // Add the current user to the participants
        participants.push(userId);

        const conversation = await this.messagingService.createConversation(
          participants
        );
        createMessageDto.conversationId = conversation.id;
      }
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

  @UseGuards(UserInConversation)
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

  @Post('conversations/feedback')
  async postConversationFeedback(
    @Body(new PostFeedbackPipe())
    postFeedbackDto: PostFeedbackDto
  ) {
    try {
      return this.messagingService.postFeedback(postFeedbackDto);
    } catch (error) {
      console.error(error);
    }
  }
}
