import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op } from 'sequelize';
import { Nudge } from 'src/nudge/models';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileNudge } from 'src/user-profiles/models/user-profile-nudge.model';

@Injectable()
export class UserProfileNudgesService {
  constructor(
    @InjectModel(UserProfileNudge)
    private userProfileNudgeModel: typeof UserProfileNudge
  ) {}

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

  async updateNudgesByUserProfileId(
    userProfileToUpdate: UserProfile,
    nudges: Partial<Nudge>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const currentNudges = userProfileToUpdate.get('nudges');

    // Create or update userProfileNudge
    await Promise.all(
      nudges.map(async (nudge) => {
        const existingNudge = currentNudges.find(
          (existingNudge) => existingNudge.id === nudge.id
        );
        if (!existingNudge) {
          return this.userProfileNudgeModel.create(
            {
              userProfileId: userProfileToUpdate.id,
              nudgeId: nudge.id,
            },
            {
              hooks: true,
              transaction: t,
            }
          );
        }
      })
    );

    await this.userProfileNudgeModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        nudgeId: {
          [Op.ne]: null,
          [Op.notIn]: nudges.map((nudge) => nudge.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
  }

  async updateCustomNudgesByUserProfileId(
    userProfileToUpdate: UserProfile,
    customNudges: Partial<UserProfileNudge>[],
    t: sequelize.Transaction
  ): Promise<void> {
    // Remove the custom nudges that don't exist anymore
    await this.userProfileNudgeModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: customNudges
            .filter((customNudge) => !!customNudge.id)
            .map((customNudge) => customNudge.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
    // Update the custom nudges that exist
    await Promise.all(
      customNudges
        .filter((customNudge) => !!customNudge.id)
        .map(async (customNudge) => {
          const existingCustomNudge = await this.userProfileNudgeModel.findOne({
            where: {
              userProfileId: userProfileToUpdate.id,
              id: customNudge.id,
            },
          });

          if (existingCustomNudge) {
            return existingCustomNudge.update(
              {
                content: customNudge.content,
              },
              {
                hooks: true,
                transaction: t,
              }
            );
          }
        })
    );

    // Create the new custom nudges that don't exist yet
    const newCustomNudgesData = await Promise.all(
      customNudges
        .filter((customNudge) => !customNudge.id)
        .map((customNudge) => {
          return {
            userProfileId: userProfileToUpdate.id,
            content: customNudge.content,
          };
        })
    );
    await this.userProfileNudgeModel.bulkCreate(newCustomNudgesData, {
      hooks: true,
      transaction: t,
    });
  }
}
