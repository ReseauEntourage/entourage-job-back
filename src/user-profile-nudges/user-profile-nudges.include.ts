import _ from 'lodash';
import { Includeable, WhereOptions } from 'sequelize';
import { Nudge } from 'src/nudge/models';

export const getUserProfileNudgesInclude = (
  nudgesOptions: WhereOptions<Nudge> = {},
  withAttributes = true
): Includeable[] => {
  const isNudgesRequired = !_.isEmpty(nudgesOptions);

  return [
    {
      model: Nudge,
      as: 'nudges',
      required: isNudgesRequired,
      attributes: withAttributes
        ? ['id', 'value', 'nameRequest', 'nameOffer', 'order']
        : [],
      where: nudgesOptions,
      through: {
        attributes: [] as string[],
        as: 'userProfileNudges',
      },
    },
  ];
};
