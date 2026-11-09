import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from 'src/users/models';

@Injectable()
export class AssistantToolsService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  /**
   * Dedicated read of the first name, by primary key and for this single
   * column. `request.user` does not carry it, and it is deliberately not added
   * to the user loaded for every authenticated route (`findOneForJwtPayload`).
   */
  async findFirstName(userId: string): Promise<string | null> {
    const user = await this.userModel.findByPk(userId, {
      attributes: ['id', 'firstName'],
    });
    return user?.firstName ?? null;
  }
}
