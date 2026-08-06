import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { UserProfile } from 'src/user-profiles/models';
import { UsersStatsService } from 'src/users-stats/users-stats.service';

@Injectable()
export class UserProfileAnalyticsService {
  constructor(
    @InjectModel(UserProfile)
    private userProfileModel: typeof UserProfile,
    @Inject(forwardRef(() => UsersStatsService))
    private usersStatsService: UsersStatsService
  ) {}

  async calculateProfileCompletion(userId: string): Promise<number> {
    // Using a SQL query rather than models to optimize performance
    const sql = `
      SELECT
        up."hasPicture",
        up.department,
        up.description,
        u."firstName",
        u."lastName",
        u.phone,
        (SELECT COUNT(*) > 0 FROM "UserProfileSectorOccupations" upso WHERE upso."userProfileId" = up.id) AS "hasSectorOccupations",
        (SELECT COUNT(*) > 0 FROM "UserProfileSkills" ups WHERE ups."userProfileId" = up.id) AS "hasSkills",
        (SELECT COUNT(*) > 0 FROM "UserProfileNudges" upn WHERE upn."userProfileId" = up.id AND upn."nudgeId" IS NULL) AS "hasCustomNudges",
        (SELECT COUNT(*) > 0 FROM "Experiences" e WHERE e."userProfileId" = up.id) AS "hasExperiences",
        (SELECT COUNT(*) > 0 FROM "Formations" f WHERE f."userProfileId" = up.id) AS "hasFormations",
        (SELECT COUNT(*) > 0 FROM "UserProfileLanguages" upl WHERE upl."userProfileId" = up.id) AS "hasLanguages",
        (SELECT COUNT(*) > 0 FROM "Interests" i WHERE i."userProfileId" = up.id) AS "hasInterests"
      FROM "UserProfiles" up
      JOIN "Users" u ON u.id = up."userId"
      WHERE up."userId" = :userId
    `;

    const result = await this.userProfileModel.sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements: { userId },
      plain: true,
    });

    if (!result) {
      return 0;
    }

    // Calculate the completion percentage based on the returned fields
    const fields = Object.entries(result);
    if (fields.length === 0) return 0;

    // Count fields that are filled (not null, not undefined and not false)
    const filledFields = fields.filter(([fieldName, value]) => {
      // Boolean fields (starting with "has")
      if (fieldName.startsWith('has')) {
        return value === true || value === 't';
      }
      // String fields (firstName, lastName, etc.)
      if (typeof value === 'string') {
        return value?.trim().length > 0;
      }
      // Other types (null, undefined, number, etc.)
      return !!value;
    });

    // Round percentage to the nearest integer
    const percentage = Math.round((filledFields.length / fields.length) * 100);

    return percentage;
  }

  async getAverageDelayResponse(userId: string): Promise<number> {
    return this.usersStatsService.getAverageDelayResponse(userId);
  }

  async getResponseRate(userId: string): Promise<number> {
    return this.usersStatsService.getResponseRate(userId);
  }
}
