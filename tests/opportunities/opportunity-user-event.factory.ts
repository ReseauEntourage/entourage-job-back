// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as _ from 'lodash';
import moment from 'moment';
import { Contract } from 'src/common/contracts/models';
import { OpportunityUserEvent } from 'src/opportunities/models/opportunity-user-event.model';
import { EventTypeFilters } from 'src/opportunities/opportunities.types';
import { OpportunityUsersService } from 'src/opportunities/opportunity-users.service';
import { Factory, WrapperModel } from 'src/utils/types';

type ComponentKeys = 'contract';

export type Components = Record<
  ComponentKeys,
  OpportunityUserEvent[ComponentKeys] | string
>;

type ComponentKey = keyof Components;

type InjectedModels = `${ComponentKeys}Model`;

@Injectable()
export class OpportunityUserEventFactory
  implements Factory<OpportunityUserEvent>
{
  constructor(
    @InjectModel(OpportunityUserEvent)
    private opportunityUserEventModel: typeof OpportunityUserEvent,
    @InjectModel(Contract)
    private contractModel: typeof Contract,
    private opportunityUsersService: OpportunityUsersService
  ) {}

  generateOpportunityUserEvent(
    props: Partial<OpportunityUserEvent>
  ): Partial<OpportunityUserEvent> {
    const fakeData: Partial<OpportunityUserEvent> = {
      type: faker.helpers.arrayElement(EventTypeFilters).value,
      startDate: moment().toDate(),
      endDate: faker.date.future(),
      createdAt: moment().toDate(),
      updatedAt: moment().toDate(),
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<OpportunityUserEvent> = {},
    components: Partial<Components> = {},
    insertInDB = true
  ): Promise<OpportunityUserEvent> {
    const opportunityUserEventData = this.generateOpportunityUserEvent(props);
    const opportunityUserEventId = faker.datatype.uuid();
    if (insertInDB) {
      const createdOpportunityUserEvent =
        await this.opportunityUserEventModel.create(
          {
            ...opportunityUserEventData,
            id: opportunityUserEventId,
          },
          {
            hooks: true,
          }
        );

      await Promise.all(
        Object.keys(components).map(async (componentKey) => {
          const injectedModelName = `${componentKey}Model` as InjectedModels;

          const injectedModel = this[injectedModelName] as typeof WrapperModel;

          const component = components[componentKey as ComponentKey];
          let instance: WrapperModel;
          if (_.isString(component)) {
            instance = await injectedModel.create(
              {
                name: component,
              },
              { hooks: true }
            );
          } else {
            instance = await injectedModel.create(
              component as Partial<WrapperModel>,
              {
                hooks: true,
              }
            );
          }

          await createdOpportunityUserEvent.$set(
            componentKey as keyof WrapperModel,
            instance
          );
        })
      );
    }
    const dbOpportunity =
      await this.opportunityUsersService.findOneOpportunityUserEvent(
        opportunityUserEventData.id || opportunityUserEventId
      );
    if (dbOpportunity) {
      return dbOpportunity.toJSON();
    }
    const builtOpportunityUserEvent =
      await this.opportunityUserEventModel.build(opportunityUserEventData);
    const { id, ...builtOpportunityUserEventWithoutId } =
      builtOpportunityUserEvent.toJSON();
    return builtOpportunityUserEventWithoutId as OpportunityUserEvent;
  }
}
