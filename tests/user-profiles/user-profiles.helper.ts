import path from 'path';
import { Injectable } from '@nestjs/common';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';

@Injectable()
export class UserProfilesHelper {
  constructor(private userProfilesService: UserProfilesService) {}

  async findOneProfileByUserId(userId: string) {
    return this.userProfilesService.findOneByUserId(userId);
  }

  async findOneProfile(profileId: string) {
    return this.userProfilesService.findOne(profileId);
  }

  getTestImagePath() {
    return path.join(process.cwd(), '/tests/test-data/image-test.jpg');
  }

  mapUserProfileFromUser(
    user: User,
    complete = false
  ): Partial<UserProfile & User> {
    const config = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      description: user.userProfile.description,
      introduction: user.userProfile.introduction,
      currentJob: user.userProfile.currentJob,
      department: user.userProfile.department,
      isAvailable: user.userProfile.isAvailable,
      lastReceivedMessage: null,
      lastSentMessage: null,
      sectorOccupations: expect.arrayContaining(
        user.userProfile.sectorOccupations.map((sectorOccupation) => ({
          id: sectorOccupation.id,
          businessSector: expect.objectContaining({
            id: sectorOccupation.businessSector.id,
          }),
          occupation: sectorOccupation.occupation
            ? expect.objectContaining({
                name: sectorOccupation.occupation.name,
              })
            : null,
          order: sectorOccupation.order,
        }))
      ),
      nudges: user.userProfile.nudges,
    } as Partial<UserProfile & User>;
    if (complete) {
      config.experiences = expect.arrayContaining(
        user.userProfile.experiences.map((experience) => ({
          id: experience.id,
          title: experience.title,
          description: experience.description,
          location: experience.location,
          company: experience.company,
          startDate: experience.startDate?.toISOString(),
          endDate: experience.endDate?.toISOString(),
          skills: expect.arrayContaining(
            experience.skills.map((skill) =>
              expect.objectContaining({
                id: skill.id,
                name: skill.name,
              })
            )
          ),
        }))
      );
      config.formations = expect.arrayContaining(
        user.userProfile.formations.map((formation) => ({
          id: formation.id,
          title: formation.title,
          description: formation.description,
          location: formation.location,
          institution: formation.institution,
          startDate: formation.startDate?.toISOString(),
          endDate: formation.endDate?.toISOString(),
          skills: expect.arrayContaining(
            formation.skills.map((skill) =>
              expect.objectContaining({
                id: skill.id,
                name: skill.name,
              })
            )
          ),
        }))
      );
      config.contracts = expect.arrayContaining(
        user.userProfile.contracts.map((contract) =>
          expect.objectContaining({
            id: contract.id,
            name: contract.name,
          })
        )
      );
      config.skills = expect.arrayContaining(
        user.userProfile.skills.map((skill) =>
          expect.objectContaining({
            id: skill.id,
            name: skill.name,
          })
        )
      );
      config.userProfileLanguages = expect.arrayContaining(
        user.userProfile.userProfileLanguages.map((upLanguages) =>
          expect.objectContaining({
            id: upLanguages.id,
            language: expect.objectContaining({
              id: upLanguages.language.id,
              name: upLanguages.language.name,
            }),
            level: upLanguages.level,
          })
        )
      );
      config.interests = expect.arrayContaining(
        user.userProfile.interests.map((interest) =>
          expect.objectContaining({
            id: interest.id,
            name: interest.name,
          })
        )
      );
      config.customNudges = expect.arrayContaining(
        user.userProfile.customNudges.map((customNudge) =>
          expect.objectContaining({
            id: customNudge.id,
            content: customNudge.content,
          })
        )
      );
      config.reviews = expect.arrayContaining(
        user.userProfile.reviews.map((review) =>
          expect.objectContaining({
            id: review.id,
            authorName: review.authorName,
            authorLabel: review.authorLabel,
            content: review.content,
          })
        )
      );
    }
    return config;
  }

  async createUserProfileRecommendations(
    userId: string,
    usersToRecommendIds: string[]
  ) {
    return this.userProfilesService.createRecommendations(
      userId,
      usersToRecommendIds
    );
  }
}
