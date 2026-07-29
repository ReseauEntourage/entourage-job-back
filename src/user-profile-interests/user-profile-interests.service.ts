import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op } from 'sequelize';
import { Interest } from 'src/interests/models';
import { UserProfile } from 'src/user-profiles/models';

@Injectable()
export class UserProfileInterestsService {
  constructor(
    @InjectModel(Interest)
    private interestModel: typeof Interest
  ) {}

  async updateInterestsByUserProfileId(
    userProfileToUpdate: UserProfile,
    interests: Partial<Interest>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const interestsData = interests.map((interest, order) => {
      return {
        userProfileId: userProfileToUpdate.id,
        name: interest.name,
        order,
      };
    });
    const userProfileInterests = await this.interestModel.bulkCreate(
      interestsData,
      {
        hooks: true,
        transaction: t,
      }
    );
    await this.interestModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: userProfileInterests.map((interest) => interest.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
  }

  async findByUserProfileId(userProfileId: string) {
    return this.interestModel.findAll({
      where: { userProfileId },
      attributes: ['id', 'name', 'order'],
      order: [['order', 'ASC']],
    });
  }
}
