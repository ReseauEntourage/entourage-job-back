import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { UserPermissions, UserPermissionsGuard } from 'src/users/guards';
import { Permissions } from 'src/users/users.types';
import {
  CreateMessagePipe,
  CreateMessageDto,
  PostFeedbackPipe,
  PostFeedbackDto,
} from './dto';
import { CreateMailingListDto } from './dto/create-mailing-list.dto';
import { CreateMailingListPipe } from './dto/create-mailing-list.pipe';
import { ReportConversationDto } from './dto/report-conversation.dto';
import { ReportAbusePipe } from './dto/report-conversation.pipe';
import { UserInConversation } from './guards/user-in-conversation';
import {
  ErrorMessagingCantParticipate,
  ErrorMessagingElearningNotCompleted,
  ErrorMessagingInvalidCursor,
  ErrorMessagingInvalidMessage,
  ErrorMessagingMailingListInvalid,
  ErrorMessagingNeedParticipantsOrConversationId,
  ErrorMessagingReachedDailyConversationLimit,
  ErrorMessagingRecipientNotEligible,
} from './messaging.errors';
import { MessagingService } from './messaging.service';
import { decodeMessageCursor } from './messaging.utils';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('messaging')
export class MessagingController {
  readonly logger = new Logger(MessagingController.name);
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
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string,
    @Query('before') before?: string,
    @Query('after') after?: string
  ) {
    try {
      return await this.messagingService.getConversationById(
        conversationId,
        userId,
        {
          before: before ? decodeMessageCursor(before) : undefined,
          after: after ? decodeMessageCursor(after) : undefined,
        }
      );
    } catch (error) {
      if (error instanceof ErrorMessagingInvalidCursor) {
        throw new BadRequestException('Cursor de pagination invalide.');
      }
      throw error;
    }
  }

  @UseGuards(UserInConversation)
  @Post('conversations/:conversationId/seen')
  async markConversationAsSeen(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Param('conversationId', new ParseUUIDPipe()) conversationId: string
  ) {
    await this.messagingService.setConversationHasSeen(conversationId, userId);
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
      } else if (error instanceof ErrorMessagingElearningNotCompleted) {
        throw new UnauthorizedException(
          "Vous devez terminer votre parcours de formation avant de pouvoir contacter d'autres membres. Rendez-vous sur la page Formations pour le compléter."
        );
      } else if (error instanceof ErrorMessagingRecipientNotEligible) {
        throw new UnauthorizedException(
          "Cette personne n'est pas disponible actuellement."
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
      this.logger.error(error);
    }
  }

  @UserPermissions(Permissions.ADMIN)
  @UseGuards(UserPermissionsGuard)
  @Post('mailing-lists')
  async createMailingList(
    @Body(new CreateMailingListPipe())
    createMailingListDto: CreateMailingListDto
  ) {
    try {
      return await this.messagingService.createMailingList(
        createMailingListDto
      );
    } catch (error) {
      this.logger.error(error);
      if (error instanceof ErrorMessagingMailingListInvalid) {
        throw new BadRequestException(error.message);
      } else {
        throw new HttpException(
          'An error occurred while creating the mailing list.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }
}
