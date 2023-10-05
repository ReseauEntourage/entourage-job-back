import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Public } from 'src/auth/guards';
import { CandidateUserRoles } from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { isValidPhone } from 'src/utils/misc';
import { CreateExternalMessageDto, CreateExternalMessagePipe } from './dto';
import { ExternalMessagesService } from './external-messages.service';
import { ExternalMessageSubjects } from './external-messages.types';

@Controller('externalMessage')
export class ExternalMessagesController {
  constructor(
    private readonly externalMessagesService: ExternalMessagesService
  ) {}

  @Public()
  @Post()
  async create(
    @Body(new CreateExternalMessagePipe())
    createMessageDto: CreateExternalMessageDto
  ) {
    const candidate = await this.externalMessagesService.findOneUser(
      createMessageDto.UserId
    );

    if (!candidate) {
      throw new NotFoundException();
    }

    if (
      (createMessageDto.senderPhone &&
        !isValidPhone(createMessageDto.senderPhone)) ||
      !isRoleIncluded(CandidateUserRoles, candidate.role) ||
      !createMessageDto.optInContact
    ) {
      throw new BadRequestException();
    }

    const createdMessage = await this.externalMessagesService.create(
      createMessageDto
    );

    const isHiringOffer =
      createMessageDto.subject === ExternalMessageSubjects.HIRING;

    await this.externalMessagesService.sendExternalMessageReceivedMail(
      candidate,
      createdMessage,
      isHiringOffer
    );

    await this.externalMessagesService.createOrUpdateExternalDBTask(
      createdMessage.id
    );

    return createdMessage;
  }
}
