import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { validate as uuidValidate } from 'uuid';
import { Public, UserPayload } from 'src/auth/guards';
import { ThrottleUserIdGuard } from 'src/users/guards/throttle-user-id.guard';
import { CandidateUserRoles, UserRole, UserRoles } from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { isValidPhone } from 'src/utils/misc';
import {
  CreateExternalMessageDto,
  CreateExternalMessagePipe,
  CreateInternalMessagePipe,
  CreateInternalMessageDto,
} from './dto';
import { MessagesService } from './messages.service';
import { ExternalMessageSubjects } from './messages.types';

@Controller('message')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Public()
  @Post('external')
  async createExternalMessage(
    @Body(new CreateExternalMessagePipe())
    createMessageDto: CreateExternalMessageDto
  ) {
    const candidate = await this.messagesService.findOneUser(
      createMessageDto.UserId
    );

    if (!candidate) {
      throw new NotFoundException();
    }

    if (
      (createMessageDto.senderPhone &&
        !isValidPhone(createMessageDto.senderPhone)) ||
      !isRoleIncluded(CandidateUserRoles, candidate.role)
    ) {
      throw new BadRequestException();
    }

    const createdMessage = await this.messagesService.createExternalMessage(
      createMessageDto
    );

    const isHiringOffer =
      createMessageDto.subject === ExternalMessageSubjects.HIRING;

    await this.messagesService.sendExternalMessageReceivedMail(
      candidate,
      createdMessage,
      isHiringOffer
    );

    await this.messagesService.createOrUpdateExternalDBTask(createdMessage.id);

    return createdMessage;
  }

  @Post('internal')
  @UseGuards(ThrottleUserIdGuard) // No more than 10 internal messages per day per userId
  async createInternalMessage(
    @UserPayload('id', new ParseUUIDPipe()) userId: string,
    @Body(new CreateInternalMessagePipe())
    createMessageDto: CreateInternalMessageDto
  ) {
    const senderUser = await this.messagesService.findOneUser(userId);

    const addresseeUser = await this.messagesService.findOneUser(
      createMessageDto.addresseeUserId
    );

    if (!addresseeUser || !senderUser) {
      throw new NotFoundException();
    }

    const createdMessage = await this.messagesService.createInternalMessage({
      senderUserId: userId,
      ...createMessageDto,
    });

    await this.messagesService.sendInternalMessageByMail(
      senderUser,
      addresseeUser,
      createdMessage
    );

    return createdMessage;
  }

  @Public()
  @Post('internal/:internalMessageId/send')
  async createInternalMessageForce(
    @UserPayload('role') role: UserRole,
    @Param('internalMessageId', new ParseUUIDPipe()) internalMessageId: string,
    @UserPayload('id') userId?: string
  ) {
    if (userId && !uuidValidate(userId)) {
      throw new BadRequestException();
    }
    const isLoggedAsAdmin = role === UserRoles.ADMIN;

    if (!isLoggedAsAdmin) {
      throw new ForbiddenException();
    }
    const loggedInAdminUser = await this.messagesService.findOneUser(userId);

    const internalMessage = await this.messagesService.findOneInternalMessage(
      internalMessageId
    );
    const senderUser = await this.messagesService.findOneUser(
      internalMessage.senderUserId
    );
    const addresseeUser = await this.messagesService.findOneUser(
      internalMessage.addresseeUserId
    );
    await this.messagesService.sendInternalMessageByMail(
      senderUser,
      addresseeUser,
      internalMessage
    );

    await this.messagesService.sendInternalMessageResendSlackNotification(
      internalMessage,
      loggedInAdminUser,
      senderUser,
      addresseeUser
    );

    return {
      message: `Internal message ${internalMessageId} sent`,
    };
  }
}
