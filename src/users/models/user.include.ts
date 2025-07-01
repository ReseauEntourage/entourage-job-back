import { Includeable, Order, OrderItem } from 'sequelize';
import { UserSocialSituation } from '../../user-social-situations/models/user-social-situation.model';
import { Organization } from 'src/organizations/models';
import { ReadDocument } from 'src/read-documents/models';
import { UserProfile } from 'src/user-profiles/models';
import {
  publicProfileAttributes,
  UserProfilesAttributes,
} from 'src/user-profiles/models/user-profile.attributes';
import {
  getUserProfileInclude,
  getUserProfileOrder,
  publicProfileIncludes,
  publicProfileOrder,
} from 'src/user-profiles/models/user-profile.include';
import { UserCandidatAttributes } from './user-candidat.attributes';
import { UserCandidat } from './user-candidat.model';
import { UserAttributes } from './user.attributes';
import { User } from './user.model';

export const UserCandidatInclude = (complete = false): Includeable[] => {
  return [
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
              include: getUserProfileInclude(complete),
              order: getUserProfileOrder(complete),
            },
          ],
        },
      ],
    },
    {
      model: User,
      as: 'referer',
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
      model: User,
      as: 'referredCandidates',
      attributes: [...UserAttributes],
      include: [
        {
          model: UserCandidat,
          as: 'candidat',
          attributes: [...UserCandidatAttributes],
          paranoid: false,
          include: [
            {
              model: User,
              as: 'candidat',
              attributes: [...UserAttributes],
            },
          ],
        },
      ],
    },
    {
      model: UserSocialSituation,
      as: 'userSocialSituation',
      attributes: ['hasCompletedSurvey'],
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
      include: getUserProfileInclude(complete),
      order: getUserProfileOrder(complete),
    },
    {
      model: ReadDocument,
      as: 'readDocuments',
      attributes: ['documentName', 'createdAt'],
    },
  ];
};

export const getUserCandidatOrder = (complete = false): Order => {
  const userProfileOrder = getUserProfileOrder(complete) as OrderItem[];

  // Prefix all the userProfileOrder items with 'userProfile' model
  // and 'as' alias
  const prefixedUserProfileOrder = userProfileOrder.map((item) => {
    if (Array.isArray(item)) {
      return [{ model: UserProfile, as: 'userProfile' }, ...item] as OrderItem;
    }
    return item;
  });
  return prefixedUserProfileOrder;
};

export const userPublicProfileInclude: Includeable[] = [
  {
    model: UserProfile,
    as: 'userProfile',
    attributes: publicProfileAttributes,
    include: publicProfileIncludes,
  },
];

export const userPublicProfileOrder = (): Order => {
  const userProfileOrder = publicProfileOrder as OrderItem[];

  // Prefix all the userProfileOrder items with 'userProfile' model
  // and 'as' alias
  const prefixedUserProfileOrder = userProfileOrder.map((item) => {
    if (Array.isArray(item)) {
      return [{ model: UserProfile, as: 'userProfile' }, ...item] as OrderItem;
    }
    return item;
  });

  return prefixedUserProfileOrder;
};

export const getUserProfileRecommendationOrder = (complete = false): Order => {
  const userProfileOrder = getUserProfileOrder(complete) as OrderItem[];

  // Prefix all the userProfileOrder items with 'userProfile' model
  // and 'as' alias
  const prefixedUserProfileOrder = userProfileOrder.map((item) => {
    if (Array.isArray(item)) {
      return [{ model: UserProfile, as: 'userProfile' }, ...item] as OrderItem;
    }
    return item;
  });

  // Then prefix all the userProfileOrder items with 'recUser' model
  const prefixedRecommendedUserOrder = prefixedUserProfileOrder.map((item) => {
    if (Array.isArray(item)) {
      return [{ model: User, as: 'recUser' }, ...item] as OrderItem;
    }
    return item;
  });

  // Finally, add the 'recUser' model and 'createdAt' order
  return [
    [{ model: User, as: 'recUser' }, 'createdAt', 'ASC'],
    ...prefixedRecommendedUserOrder,
  ];
};
