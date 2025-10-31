import { IncludeOptions, Op } from 'sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Department } from 'src/common/departments/models/department.model';
import { Conversation } from 'src/messaging/models';
import { UserProfile } from 'src/user-profiles/models';
import { getUserProfileInclude } from 'src/user-profiles/models/user-profile.include';
import { User } from 'src/users/models';
import { UserAttributesVisibleByCompanyAdmins } from 'src/users/models/user.attributes';
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

export const companiesWithUsers = ({
  departments = [],
  businessSectorIds = [],
  asCompanyAdmin = false,
}: {
  departments?: string[];
  businessSectorIds?: string[];
  asCompanyAdmin?: boolean;
}): IncludeOptions[] => [
  // Default includes
  ...companiesIncludes(departments, businessSectorIds),

  // User includes
  {
    model: User,
    as: 'users',
    attributes: UserAttributesVisibleByCompanyAdmins,
    include: [
      {
        model: UserProfile,
        attributes: ['id', 'hasPicture', 'isAvailable', 'currentJob'],
        include: [...getUserProfileInclude()],
      },
      ...(asCompanyAdmin
        ? [
            {
              model: CompanyInvitation,
              as: 'invitations',
            },
            {
              model: Conversation,
              as: 'conversations',
            },
          ]
        : []),
    ],
    through: {
      attributes: ['isAdmin', 'role'],
      as: 'companyUser',
    },
  },

  // Pending invitations
  ...(asCompanyAdmin
    ? [
        {
          model: CompanyInvitation,
          as: 'pendingInvitations',
          where: {
            userId: null, // Only include invitations that have not been accepted
          },
          required: false,
        },
      ]
    : []),
];
