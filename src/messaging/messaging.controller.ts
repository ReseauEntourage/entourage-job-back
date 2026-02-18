import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import {
  CreateMessagePipe,
  CreateMessageDto,
  PostFeedbackPipe,
  PostFeedbackDto,
} from './dto';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { ReportAbusePipe } from './dto/report-conversation.pipe';
import { UserInConversation } from './guards/user-in-conversation';
import {
  ErrorMessagingCantParticipate,
  ErrorMessagingInvalidMessage,
  ErrorMessagingNeedParticipantsOrConversationId,
  ErrorMessagingReachedDailyConversationLimit,
} from './messaging.errors';
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
  @UseInterceptors(FilesInterceptor('files', 10))
  async postMessage(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Body(new CreateMessagePipe())
    createMessageDto: CreateMessageDto,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    try {
      const message = await this.messagingService.createMessageWithConversation(
        createMessageDto,
        userId,
        files
      );
      return message;
    } catch (error) {
      if (
        error instanceof ErrorMessagingNeedParticipantsOrConversationId ||
        error instanceof ErrorMessagingInvalidMessage
      ) {
        throw new BadRequestException(error.message);
      } else if (error instanceof ErrorMessagingCantParticipate) {
        throw new UnauthorizedException(
          'Vous ne pouvez pas participer à cette conversation.'
        );
      } else if (error instanceof ErrorMessagingReachedDailyConversationLimit) {
        throw new HttpException(
          'DAILY_CONVERSATION_LIMIT_REACHED',
          HttpStatus.TOO_MANY_REQUESTS
        );
      } else {
        throw new HttpException(
          'An error occurred while posting the message.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
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
