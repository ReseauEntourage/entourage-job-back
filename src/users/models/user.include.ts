import { Includeable } from 'sequelize';
import { Organization } from 'src/organizations/models';
import { ReadDocuments } from 'src/read-documents/models';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfilesAttributes } from 'src/user-profiles/models/user-profile.attributes';
import { getUserProfileInclude } from 'src/user-profiles/models/user-profile.include';
import { UserCandidatAttributes } from './user-candidat.attributes';
import { UserCandidat } from './user-candidat.model';
import { UserAttributes } from './user.attributes';
import { User } from './user.model';

export const UserCandidatInclude: Includeable[] = [
  {
    model: UserCandidat,
    as: 'candidat',
    attributes: [...UserCandidatAttributes],
    include: [
      {
        model: User,
        as: 'coach',
        attributes: [...UserAttributes],
        paranoid: false,
        include: [
          {
            model: UserProfile,
            as: 'userProfile',
            attributes: UserProfilesAttributes,
            include: getUserProfileInclude(),
          },
        ],
      },
    ],
  },
  {
    model: UserCandidat,
    as: 'coaches',
    attributes: [...UserCandidatAttributes],
    include: [
      {
        model: User,
        as: 'candidat',
        attributes: [...UserAttributes],
        paranoid: false,
        include: [
          {
            model: UserProfile,
            as: 'userProfile',
            attributes: UserProfilesAttributes,
            include: getUserProfileInclude(),
          },
        ],
      },
    ],
  },
  {
    model: Organization,
    as: 'organization',
    attributes: ['id', 'name', 'address', 'zone'],
  },
  {
    model: UserProfile,
    as: 'userProfile',
    attributes: UserProfilesAttributes,
    include: getUserProfileInclude(),
  },
  {
    model: ReadDocuments,
    attributes: ['documentName', 'createdAt'],
  },
];
