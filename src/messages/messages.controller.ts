import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { isValidPhone } from '../utils/misc';
import { Public } from 'src/auth/guards';
import { CandidateUserRoles } from 'src/users/users.types';
import { isRoleIncluded } from 'src/users/users.utils';
import { CreateMessageDto, CreateMessagePipe } from './dto';
import { MessagesService } from './messages.service';

@Controller('message')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Public()
  @Post()
  async create(
    @Body(new CreateMessagePipe()) createMessageDto: CreateMessageDto
  ) {
    const candidate = await this.messagesService.findOneUser(
      createMessageDto.UserId
    );

    if (!candidate) {
      throw new NotFoundException();
    }

    if (
      (createMessageDto.phone && !isValidPhone(createMessageDto.phone)) ||
      !isRoleIncluded(CandidateUserRoles, candidate.role)
    ) {
      throw new BadRequestException();
    }

    const createdMessage = await this.messagesService.create(createMessageDto);

    await this.messagesService.sendMessageMail(candidate, createdMessage);

    /*
      TODO later
      await this.messagesService.sendMessageToSalesforce(
        candidate,
        createdMessage
      );
    */

    return createdMessage;
  }
}
