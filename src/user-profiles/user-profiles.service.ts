import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { UsersService } from 'src/users/users.service';
import { HelpNeed, HelpOffer, UserProfile } from './models';

@Injectable()
export class UserProfilesService {
  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    @InjectModel(Ambition)
    private ambitionModel: typeof Ambition,
    @InjectModel(HelpNeed)
    private helpNeedModel: typeof HelpNeed,
    @InjectModel(HelpOffer)
    private helpOfferModel: typeof HelpOffer,
    private usersService: UsersService
  ) {}

  async findOne(id: string) {
    return this.userProfileModel.findByPk(id, {
      include: [
        {
          model: BusinessLine,
          as: 'networkBusinessLines',
          attributes: ['id', 'name', 'order'],
        },
        {
          model: BusinessLine,
          as: 'searchBusinessLines',
          attributes: ['id', 'name', 'order'],
        },
        {
          model: Ambition,
          as: 'searchAmbitions',
          attributes: ['id', 'name', 'prefix', 'order'],
        },
        {
          model: HelpNeed,
          as: 'helpNeeds',
          attributes: ['id', 'name'],
        },
        {
          model: HelpOffer,
          as: 'helpOffers',
          attributes: ['id', 'name'],
        },
      ],
    });
  }

  async findOneByUserId(userId: string) {
    return this.userProfileModel.findOne({
      where: { UserId: userId },
      include: [
        {
          model: BusinessLine,
          as: 'networkBusinessLines',
          attributes: ['id', 'name', 'order'],
        },
        {
          model: BusinessLine,
          as: 'searchBusinessLines',
          attributes: ['id', 'name', 'order'],
        },
        {
          model: Ambition,
          as: 'searchAmbitions',
          attributes: ['id', 'name', 'prefix', 'order'],
        },
        {
          model: HelpNeed,
          as: 'helpNeeds',
          attributes: ['id', 'name'],
        },
        {
          model: HelpOffer,
          as: 'helpOffers',
          attributes: ['id', 'name'],
        },
      ],
    });
  }

  async findOneUser(userId: string) {
    return this.usersService.findOne(userId);
  }

  async updateByUserId(
    userId: string,
    updateUserProfileDto: Partial<UserProfile>
  ) {
    const userProfileToUpdate = await this.findOneByUserId(userId);

    if (!userProfileToUpdate) {
      return null;
    }

    await this.userProfileModel.sequelize.transaction(async (t) => {
      await this.userProfileModel.update(updateUserProfileDto, {
        where: { UserId: userId },
        individualHooks: true,
      });

      if (updateUserProfileDto.networkBusinessLines?.length > 0) {
        const networkBusinessLines = await Promise.all(
          updateUserProfileDto.networkBusinessLines.map(
            ({ name, order = -1 }) => {
              return this.businessLineModel.create(
                { name, order },
                {
                  hooks: true,
                  transaction: t,
                }
              );
            }
          )
        );
        await userProfileToUpdate.$add(
          'networkBusinessLines',
          networkBusinessLines,
          { transaction: t }
        );
      }
      if (updateUserProfileDto.searchBusinessLines?.length > 0) {
        const searchBusinessLines = await Promise.all(
          updateUserProfileDto.searchBusinessLines.map(
            ({ name, order = -1 }) => {
              return this.businessLineModel.create(
                { name, order },
                {
                  hooks: true,
                  transaction: t,
                }
              );
            }
          )
        );
        await userProfileToUpdate.$add(
          'searchBusinessLines',
          searchBusinessLines,
          { transaction: t }
        );
      }
      if (updateUserProfileDto.searchAmbitions?.length > 0) {
        const searchAmbitions = await Promise.all(
          updateUserProfileDto.searchAmbitions.map(
            ({ name, order = -1, prefix = 'dans' }) => {
              return this.ambitionModel.create(
                { name, order, prefix },
                {
                  hooks: true,
                  transaction: t,
                }
              );
            }
          )
        );
        await userProfileToUpdate.$add('searchAmbitions', searchAmbitions, {
          transaction: t,
        });
      }
      if (updateUserProfileDto.helpNeeds?.length > 0) {
        await Promise.all(
          updateUserProfileDto.helpNeeds.map(({ name }) => {
            return this.helpNeedModel.create(
              { UserProfileId: userProfileToUpdate.id, name },
              {
                hooks: true,
                transaction: t,
              }
            );
          })
        );
      }
      if (updateUserProfileDto.helpOffers?.length > 0) {
        await Promise.all(
          updateUserProfileDto.helpOffers.map(({ name }) => {
            return this.helpOfferModel.create(
              { UserProfileId: userProfileToUpdate.id, name },
              {
                hooks: true,
                transaction: t,
              }
            );
          })
        );
      }
    });

    return this.findOneByUserId(userId);
  }

  async removeByUserId(userId: string) {
    return this.userProfileModel.destroy({
      where: { UserId: userId },
      individualHooks: true,
    });
  }
}
