// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as uuid from 'uuid';
import { BusinessSector } from 'src/common/business-sectors/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class BusinessSectorFactory implements Factory<BusinessSector> {
  constructor(
    @InjectModel(BusinessSector)
    private businessSector: typeof BusinessSector
  ) {}

  generateBusinessSector(
    props: Partial<BusinessSector>
  ): Partial<BusinessSector> {
    const name =
      props.name || faker.lorem.word({ length: { min: 5, max: 10 } });
    return {
      id: uuid.v4(),
      name: name,
      value: props.value || name.slice(0, 3),
      prefixes: "l'",
    };
  }

  async create(props: Partial<BusinessSector> = {}): Promise<BusinessSector> {
    const businessSector = this.generateBusinessSector(props);
    return this.businessSector.create(businessSector);
  }
}
