import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { isUUID } from 'class-validator';
import { User } from 'src/users/models';
import { UserRoles } from 'src/users/users.types';

/**
 * Gives access to the AI assistant thread of a recipient.
 *
 * The caller must not be a candidate and must be eligible to contact (its
 * eLearning is completed). The recipient must be an existing candidate. The
 * recipient's own eLearning status is deliberately not checked, and no
 * conversation between the two is required: the assistant can be used before
 * the first message is sent.
 */
@Injectable()
export class AssistantRecipientGuard implements CanActivate {
  private readonly logger = new Logger(AssistantRecipientGuard.name);

  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const callerId: string = request.user.id;
    const { recipientId } = request.params;

    // Guards run before pipes: an invalid id must not reach the database.
    if (!isUUID(recipientId, '4')) {
      throw new BadRequestException('Identifiant de destinataire invalide.');
    }

    const [caller, recipient] = await Promise.all([
      this.userModel.findByPk(callerId, {
        attributes: ['id', 'role', 'elearningCompletedAt'],
      }),
      this.userModel.findByPk(recipientId, { attributes: ['id', 'role'] }),
    ]);

    if (!caller || caller.role === UserRoles.CANDIDATE) {
      throw new UnauthorizedException(
        "Seuls les coachs peuvent utiliser l'assistant."
      );
    }

    if (!caller.elearningCompletedAt) {
      this.logger.warn(
        `AI assistant refused: user ${callerId} has not completed the eLearning`
      );
      throw new UnauthorizedException(
        "Vous devez terminer votre formation pour utiliser l'assistant."
      );
    }

    if (!recipient || recipient.role !== UserRoles.CANDIDATE) {
      throw new NotFoundException('Destinataire introuvable.');
    }

    return true;
  }
}
