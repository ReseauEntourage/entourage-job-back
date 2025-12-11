import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
    // Check if user can participate
    const canParticipate = await this.messagingService.canParticipate(
      userId,
      createMessageDto
    );
    if (!canParticipate) {
      throw new UnauthorizedException(
        'Vous ne pouvez pas participer à cette conversation.'
      );
    }
    if ((!files || files.length <= 0) && createMessageDto.content.length <= 0) {
      throw new BadRequestException(
        'Le message doit contenir au moins un caractère.'
      );
    }

    // Create the conversation if needed
    if (!createMessageDto.conversationId && createMessageDto.participantIds) {
      await this.messagingService.handleDailyConversationLimit(
        userId,
        createMessageDto.participantIds,
        createMessageDto.content
      );
      return this.messagingService.createConversationWithFirstMessage({
        participantIds: createMessageDto.participantIds,
        authorId: userId,
        createMessageDto,
        files,
      });
    }
    try {
      return await this.messagingService.createMessage({
        authorId: userId,
        ...createMessageDto,
        files,
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
