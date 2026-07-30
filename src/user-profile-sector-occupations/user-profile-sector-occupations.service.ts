import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import sequelize, { Op } from 'sequelize';
import { Occupation } from 'src/occupations/models';
import {
  UserProfile,
  UserProfileSectorOccupation,
  UserProfileSectorOccupationWithPartialAssociations,
} from 'src/user-profiles/models';

@Injectable()
export class UserProfileSectorOccupationsService {
  constructor(
    @InjectModel(Occupation)
    private occupationModel: typeof Occupation,
    @InjectModel(UserProfileSectorOccupation)
    private userProfileSectorOccupationModel: typeof UserProfileSectorOccupation
  ) {}

  async updateSectorOccupationsByUserProfileId(
    userProfileToUpdate: UserProfile,
    sectorOccupations: Partial<UserProfileSectorOccupationWithPartialAssociations>[],
    t: sequelize.Transaction
  ): Promise<void> {
    const newSectorOccupations = await Promise.all(
      sectorOccupations.map(async ({ businessSectorId, occupation, order }) => {
        const existingSectorOccupation =
          await this.userProfileSectorOccupationModel.findOne({
            where: {
              userProfileId: userProfileToUpdate.id,
              businessSectorId,
            },
            include: [
              {
                model: Occupation,
                as: 'occupation',
                attributes: ['name'],
                where:
                  occupation && occupation.name
                    ? { name: occupation.name }
                    : undefined,
              },
            ],
          });

        if (existingSectorOccupation) {
          return existingSectorOccupation;
        }
        let newOccupation = null;
        if (occupation && occupation.name) {
          newOccupation = await this.occupationModel.create(
            {
              name: occupation.name,
            },
            {
              hooks: true,
              transaction: t,
            }
          );
        }
        return await this.userProfileSectorOccupationModel.create(
          {
            userProfileId: userProfileToUpdate.id,
            businessSectorId,
            occupationId: newOccupation ? newOccupation.id : undefined,
            order,
          },
          {
            hooks: true,
            transaction: t,
          }
        );
      })
    );

    await this.userProfileSectorOccupationModel.destroy({
      where: {
        userProfileId: userProfileToUpdate.id,
        id: {
          [Op.notIn]: newSectorOccupations.map(
            (sectorOccupation) => sectorOccupation.id
          ),
        },
      },
      individualHooks: true,
      transaction: t,
    });

    await userProfileToUpdate.$set('sectorOccupations', newSectorOccupations, {
      transaction: t,
    });
  }
}
