// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as uuid from 'uuid';
import { Nudge } from 'src/common/nudge/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class NudgeFactory implements Factory<Nudge> {
  constructor(
    @InjectModel(Nudge)
    private nudgeModel: typeof Nudge
  ) {}

  generateNudge(props: Partial<Nudge>): Partial<Nudge> {
    const value =
      props.value || faker.lorem.word({ length: { min: 5, max: 10 } });
    return {
      id: uuid.v4(),
      value: value,
      nameRequest: props.nameRequest || `${value.slice(0, 3)} Request`,
      nameOffer: props.nameOffer || `${value.slice(0, 3)} Offer`,
      order: props.order || 0,
    };
  }

  async create(props: Partial<Nudge> = {}): Promise<Nudge> {
    const nudge = this.generateNudge(props);
    return this.nudgeModel.create(nudge);
  }
}
