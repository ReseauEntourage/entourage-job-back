import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Public, UserPayload } from 'src/auth/guards';
import { CandidateUserRoles } from 'src/users/users.types';
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

    await this.messagesService.createOrUpdateExternalDBTask(createdMessage.id);

    return createdMessage;
  }
}
