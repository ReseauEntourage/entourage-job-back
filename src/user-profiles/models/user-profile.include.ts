import { Includeable } from 'sequelize';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { HelpNeed } from './help-need.model';
import { HelpOffer } from './help-offer.model';

export function getUserProfileInclude(): Includeable[] {
  return [
    {
      model: BusinessLine,
      as: 'networkBusinessLines',
      attributes: ['id', 'name', 'order'],
    },
    {
      model: BusinessLine,
      as: 'searchBusinessLines',
      attributes: ['id', 'name', 'order'],
    },
    {
      model: Ambition,
      as: 'searchAmbitions',
      attributes: ['id', 'name', 'prefix', 'order'],
    },
    {
      model: HelpNeed,
      as: 'helpNeeds',
      attributes: ['id', 'name'],
    },
    {
      model: HelpOffer,
      as: 'helpOffers',
      attributes: ['id', 'name'],
    },
  ];
}
