import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op } from 'sequelize';
import { Language } from 'src/languages/models';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfileLanguage } from 'src/user-profiles/models/user-profile-language.model';

@Injectable()
export class UserProfileLanguagesService {
  constructor(
    @InjectModel(UserProfileLanguage)
    private userProfileLanguageModel: typeof UserProfileLanguage
  ) {}

  async findLanguagesByUserProfileId(userProfileId: string) {
    return this.userProfileLanguageModel.findAll({
      where: { userProfileId },
      attributes: ['id', 'level'],
      include: [
        {
          model: Language,
          as: 'language',
          required: false,
          attributes: ['id', 'name'],
        },
      ],
    });
  }

  async updateUserProfileLanguagesByUserProfileId(
    userProfileToUpdate: UserProfile,
    userProfileLanguages: Partial<UserProfileLanguage>[],
    t: sequelize.Transaction
  ): Promise<void> {
    // Languages already exists, we need to create UserProfileLanguage
    const languagesData = userProfileLanguages.map((upLanguage) => {
      return {
        userProfileId: userProfileToUpdate.id,
        languageId: upLanguage.languageId,
        level: upLanguage.level,
      };
    });
    const createdUpLanguages = await this.userProfileLanguageModel.bulkCreate(
      languagesData,
      {
        hooks: true,
        transaction: t,
      }
    );
    await this.userProfileLanguageModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: createdUpLanguages.map((upLanguage) => upLanguage.id),
        },
      },
      individualHooks: true,
      transaction: t,
    });
  }
}
