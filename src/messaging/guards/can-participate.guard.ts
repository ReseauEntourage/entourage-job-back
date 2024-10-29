import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagingService } from '../messaging.service';

@Injectable()
export class CanParticipate implements CanActivate {
  constructor(private readonly messagingService: MessagingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user.id;
    const createMessageDto = request.body;

    if (!createMessageDto.conversationId && !createMessageDto.participantIds) {
      throw new BadRequestException(
        'Vous devez fournir un identifiant de conversation ou une liste de participants.'
      );
    }

    // Ignore if the conversationId is not provided but the participantIds are
    if (!createMessageDto.conversationId && createMessageDto.participantIds) {
      return true;
    }

    const conversation = await this.messagingService.findConversation(
      createMessageDto.conversationId
    );
    if (
      !conversation.participants.some(
        (participant) => participant.id === userId
      )
    ) {
      throw new UnauthorizedException(
        'Vous ne faites pas partie de cette conversation.'
      );
    }

    return true;
  }
}
