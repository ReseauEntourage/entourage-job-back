import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Session } from './model/session.model';

const SESSION_EXPIRATION_TIME = 6 * 60 * 60 * 1000; // 6 hours

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session)
    private sessionModel: typeof Session
  ) {}

  async createOrUpdateSession(userId: string) {
    const activeSession: Session | null = await this.sessionModel.findOne({
      where: {
        userId: userId,
        createdAt: new Date(Date.now() - SESSION_EXPIRATION_TIME),
      },
      order: [['createdAt', 'DESC']],
    });

    if (activeSession) {
      return this.sessionModel.update(
        { updatedAt: new Date() },
        {
          where: {
            id: activeSession.id,
            updatedAt: new Date(Date.now()),
          },
        }
      );
    } else {
      return this.sessionModel.create({ userId: userId });
    }
  }
}
