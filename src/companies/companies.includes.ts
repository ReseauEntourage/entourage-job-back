import { IncludeOptions } from 'sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Department } from 'src/common/departments/models/department.model';
import { Conversation } from 'src/messaging/models';
import { UserProfile } from 'src/user-profiles/models';
import { User } from 'src/users/models';
import { CompanyInvitation } from './models/company-invitation.model';

export const companiesIncludes: IncludeOptions[] = [
  {
    model: Department,
    attributes: ['id', 'name', 'value'],
  },
  {
    model: BusinessSector,
    attributes: ['id', 'name', 'value'],
  },
];

export const companiesWithUsers: IncludeOptions[] = [
  // Default includes
  ...companiesIncludes,

  // User includes
  {
    model: User,
    as: 'users',
    attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt'],
    include: [
      {
        model: UserProfile,
        attributes: ['id', 'hasPicture', 'currentJob'],
      },
      {
        model: CompanyInvitation,
        as: 'invitations',
      },
      {
        model: Conversation,
        as: 'conversations',
        attributes: ['id'],
        through: {
          attributes: [],
          as: 'conversationParticipants',
        },
      },
    ],
    through: {
      attributes: ['isAdmin', 'role'],
      as: 'companyUsers',
    },
  },

  // Pending invitations
  {
    model: CompanyInvitation,
    as: 'pendingInvitations',
    where: {
      userId: null, // Only include invitations that have not been accepted
    },
    required: false,
  },

  {
    model: Conversation,
    as: 'conversations',
    attributes: ['id'],
    through: {
      attributes: [],
      as: 'conversationParticipants',
    },
  },
];
