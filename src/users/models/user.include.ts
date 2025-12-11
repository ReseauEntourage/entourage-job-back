import { Includeable, Order, OrderItem } from 'sequelize';
import { UserSocialSituation } from '../../user-social-situations/models/user-social-situation.model';
import { companiesAttributes } from 'src/companies/companies.attributes';
import { companiesWithUsers } from 'src/companies/companies.includes';
import { Company } from 'src/companies/models/company.model';
import { Organization } from 'src/organizations/models';
import { ReadDocument } from 'src/read-documents/models';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfilesAttributes } from 'src/user-profiles/models/user-profile.attributes';
import {
  getUserProfileInclude,
  getUserProfileOrder,
} from 'src/user-profiles/models/user-profile.include';
import { UserAttributes } from './user.attributes';
import { User } from './user.model';

export const UserIncludes = (): Includeable[] => {
  return [
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
      model: User,
      as: 'referredCandidates',
      attributes: [...UserAttributes],
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
      include: getUserProfileInclude(),
      order: getUserProfileOrder(),
    },
    {
      model: ReadDocument,
      as: 'readDocuments',
      attributes: ['documentName', 'createdAt'],
    },
    {
      model: Company,
      as: 'companies',
      attributes: companiesAttributes,
      through: {
        attributes: ['isAdmin', 'role'],
        as: 'companyUser',
      },
      include: companiesWithUsers({}),
    },
  ];
};

export const getUserCandidatOrder = (): Order => {
  const userProfileOrder = getUserProfileOrder() as OrderItem[];

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

export const getUserProfileRecommendationOrder = (): Order => {
  const userProfileOrder = getUserProfileOrder() as OrderItem[];

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

/**
 * Retourne un ordre de tri qui trie les utilisateurs par date de mise à jour de leur profil
 * du plus récent au plus ancien
 */
export const getUserProfileRecentlyUpdatedOrder = (): Order => {
  // L'ordre de base est par userProfile.updatedAt DESC (du plus récent au plus ancien)
  return [[{ model: UserProfile, as: 'userProfile' }, 'updatedAt', 'DESC']];
};
