import { IncludeOptions, Op } from 'sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Department } from 'src/common/departments/models/department.model';
import { UserProfile } from 'src/user-profiles/models';
import { getUserProfileInclude } from 'src/user-profiles/models/user-profile.include';
import { User } from 'src/users/models';
import { PublicUserAttributes } from 'src/users/models/user.attributes';
import { CompanyInvitation } from './models/company-invitation.model';

export const companiesIncludes = (
  departments: string[] = [],
  businessSectorIds: string[] = []
): IncludeOptions[] => [
  {
    model: Department,
    attributes: ['id', 'name', 'value'],
    required: departments?.length > 0,
    where:
      departments?.length > 0 ? { id: { [Op.in]: departments } } : undefined,
  },
  {
    model: BusinessSector,
    attributes: ['id', 'name', 'value'],
    required: businessSectorIds?.length > 0,
    where:
      businessSectorIds?.length > 0
        ? { id: { [Op.in]: businessSectorIds } }
        : undefined,
  },
];

export const companiesWithUsers = (
  departments: string[] = [],
  businessSectorIds: string[] = []
): IncludeOptions[] => [
  // Default includes
  ...companiesIncludes(departments, businessSectorIds),

  // User includes
  {
    model: User,
    as: 'users',
    attributes: PublicUserAttributes,
    include: [
      {
        model: UserProfile,
        attributes: ['id', 'hasPicture', 'isAvailable', 'currentJob'],
        include: [...getUserProfileInclude()],
      },
      {
        model: CompanyInvitation,
        as: 'invitations',
      },
    ],
    through: {
      attributes: ['isAdmin', 'role'],
      as: 'companyUser',
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
];
