import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { UserProfileNudge } from 'src/user-profiles/models/user-profile-nudge.model';
import { searchInColumnWhereOption } from 'src/utils/misc';
import { Nudge } from './models';

@Injectable()
export class NudgesService {
  constructor(
    @InjectModel(Nudge)
    private nudgeModel: typeof Nudge,
    @InjectModel(UserProfileNudge)
    private userProfileNudgeModel: typeof UserProfileNudge
  ) {}

  async findAll(limit: number, offset: number, search = '') {
    const whereQuery = searchInColumnWhereOption('Nudge.value', search);

    return this.nudgeModel.findAll({
      where: whereQuery,
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
      order: [['order', 'ASC']],
    });
  }

  async findCustomNudgesByUserProfileId(userProfileId: string) {
    return this.userProfileNudgeModel.findAll({
      where: {
        userProfileId,
        content: {
          [Op.not]: null,
        },
      },
      attributes: ['id', 'content', 'createdAt'],
      include: [
        {
          model: Nudge,
          as: 'nudge',
          required: false,
          attributes: ['id', 'value', 'nameRequest', 'nameOffer', 'order'],
        },
      ],
    });
  }
}
