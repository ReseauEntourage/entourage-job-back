import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagingService } from '../messaging.service';

@Injectable()
export class UserInConversation implements CanActivate {
  constructor(private readonly messagingService: MessagingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user.id;
    const { conversationId } = request.params;

    const conversation = await this.messagingService.findConversation(
      conversationId
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
