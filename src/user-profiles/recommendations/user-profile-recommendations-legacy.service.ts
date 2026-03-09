import { Injectable } from '@nestjs/common';
import _ from 'lodash';
import { QueryTypes } from 'sequelize';
import { UserProfileSectorOccupation } from '../models';
import { Department, Departments } from 'src/common/locations/locations.types';
import { UserRole, UserRoles } from 'src/users/users.types';
import { UserProfileRecommendationBase } from './user-profile-recommendation-base';

const UserProfileRecommendationsWeights = {
  BUSINESS_SECTORS: 0.3,
  NUDGES: 0.5,
};

@Injectable()
export class UserProfileRecommendationsLegacyService extends UserProfileRecommendationBase {
  async updateRecommendationsByUserId(userId: string) {
    const [user, userProfile] = await Promise.all([
      this.userProfilesService.findOneUser(userId),
      this.userProfilesService.findOneByUserId(userId),
    ]);

    const rolesToFind =
      user.role === UserRoles.CANDIDATE
        ? [UserRoles.COACH]
        : [UserRoles.CANDIDATE];

    const isCompanyAdmin =
      user.role === UserRoles.COACH &&
      user.company &&
      user.company.companyUser?.isAdmin;

    let nudgeIds: string[] = [];
    let businessSectorIds: string[] = [];
    let sectorOccupations: UserProfileSectorOccupation[] = [];
    let sameRegionDepartmentsOptions: Department[] = Departments.map(
      ({ name }) => name
    );

    // If the user is a company admin, we use company data for recommendations
    //  else we use user profile data
    if (isCompanyAdmin) {
      // Nudges and sectorOccupations are not used in company admin context

      // We take all business sectors of the company
      businessSectorIds = user.company.businessSectors.map(
        (sector) => sector.id
      );

      // We take the department of the company
      if (user.company.department) {
        const constructedDepartment = `${user.company.department.name} (${user.company.department.value})`;
        // Validate the constructed string against Department enum values
        sameRegionDepartmentsOptions = [constructedDepartment as Department];
      }
    } else {
      nudgeIds = userProfile.nudges.map((nudge) => nudge.id);
      sectorOccupations = userProfile.sectorOccupations;
      businessSectorIds = sectorOccupations
        .map((sectorOccupation) => sectorOccupation.businessSector?.id)
        .filter((id) => id !== undefined);
      sameRegionDepartmentsOptions = userProfile.department
        ? Departments.filter(
            ({ region }) =>
              region ===
              Departments.find(({ name }) => userProfile.department === name)
                .region
          ).map(({ name }) => name)
        : Departments.map(({ name }) => name);
    }

    interface UserRecommendationSQL {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      department: Department;
      currentJob: string;
      role: UserRole;
      lastConnection: Date;
      createdAt: Date;
      occupations: string;
      businessSectorIds: string;
      nudgeIds: string;
    }

    const sql = `
    SELECT
      u.id,
      u."firstName",
      u."lastName",
      u.email,
      up.department,
      u.role,
      u."lastConnection",
      u."createdAt" as "createdAt",
      string_agg(DISTINCT upso."businessSectorId"::text, ', ') as "businessSectorIds",
      string_agg(DISTINCT upn."nudgeId"::text, ', ') as "nudgeIds"
    
    FROM "Users" u
    LEFT JOIN "UserProfiles" up
      ON u.id = up."userId"
    
    LEFT JOIN "UserProfileSectorOccupations" upso
      ON up.id = upso."userProfileId"

    LEFT JOIN "UserProfileNudges" upn
      ON up.id = upn."userProfileId"
    
    WHERE u."deletedAt" IS NULL
    AND up."isAvailable" IS TRUE
    AND up.department IN (${sameRegionDepartmentsOptions.map(
      // remplacer un appostrophe par deux appostrophes
      (department) => `'${department.replace(/'/g, "''")}'`
    )})
    AND u.role IN (${rolesToFind.map((role) => `'${role}'`)})
    AND u."lastConnection" IS NOT NULL
        
    GROUP BY u.id, u."firstName", u."lastName", u.email, u."zone", u.role, u."lastConnection", up.department
    ;`;

    const profiles: UserRecommendationSQL[] =
      await this.userProfileRecommandationModel.sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });

    const sortedProfiles = _.orderBy(
      profiles,
      [
        (profile) => {
          const profileBusinessSectors = profile.businessSectorIds
            ? profile.businessSectorIds.split(', ')
            : [];

          const businessSectorsDifference = _.difference(
            businessSectorIds,
            profileBusinessSectors
          );

          const businessSectorsMatching =
            (businessSectorIds.length - businessSectorsDifference.length) *
            UserProfileRecommendationsWeights.BUSINESS_SECTORS;

          const profileNudgeIds = profile.nudgeIds
            ? profile.nudgeIds.split(', ')
            : [];

          const nudgesDifferences = _.difference(nudgeIds, profileNudgeIds);

          const nudgesMatching =
            (nudgeIds.length - nudgesDifferences.length) *
            UserProfileRecommendationsWeights.NUDGES;

          return businessSectorsMatching + nudgesMatching;
        },
        ({ department }) => department === userProfile.department,
        ({ createdAt }) => createdAt,
      ],
      ['desc', 'asc', 'desc']
    );

    return this.createRecommendations(
      userId,
      sortedProfiles.slice(0, 3).map((profile) => profile.id)
    );
  }
}
