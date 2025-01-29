import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Session } from './model/session.model';

const SESSION_EXPIRATION_TIME = 6 * 60 * 60 * 1000; // 6 hours

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session)
    private sessionModel: typeof Session
  ) {}

  async createOrUpdateSession(userId: string) {
    // Find a session where the userId matches and the createdAt date is within the last 6 hours
    const activeSession = await this.sessionModel.findOne({
      where: {
        [Op.and]: [
          {
            userId,
          },
          {
            createdAt: {
              [Op.gte]: new Date(
                new Date().getTime() - SESSION_EXPIRATION_TIME
              ),
            },
          },
        ],
      },
    });

    // If there is an active session, update the session, else create a new session
    if (activeSession) {
      const updatedSession: Partial<Session> = {
        id: activeSession.id,
        updatedAt: new Date(),
      };

      await this.sessionModel.update(updatedSession, {
        where: { id: activeSession.id },
      });
    } else {
      await this.sessionModel.create({ userId });
    }
  }
}
