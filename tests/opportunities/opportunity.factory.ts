// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as _ from 'lodash';
import moment from 'moment';
import phone from 'phone';
import { BusinessLine } from 'src/businessLines/models';
import { Departments } from 'src/locations/locations.types';
import { Opportunity, OpportunityUser } from 'src/opportunities/models';
import { OpportunitiesService } from 'src/opportunities/opportunities.service';
import { Factory, WrapperModel } from 'src/utils/types';

type ComponentKeys = 'businessLine';

type PluralComponentKeys = `${ComponentKeys}s`;

export type Components = Record<
  PluralComponentKeys,
  Opportunity[PluralComponentKeys] | string[]
>;

type ComponentKey = keyof Components;

type InjectedModels = `${ComponentKeys}Model`;

@Injectable()
export class OpportunityFactory implements Factory<Opportunity> {
  constructor(
    @InjectModel(Opportunity)
    private opportunityModel: typeof Opportunity,
    @InjectModel(OpportunityUser)
    private opportunityUserModel: typeof OpportunityUser,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    private opportunitiesService: OpportunitiesService
  ) {}

  totalOppsInDB = 0;

  getTotalOppsInDB() {
    return this.totalOppsInDB;
  }

  incrTotalOppsInDB() {
    this.totalOppsInDB += 1;
  }

  generateOpportunity(props: Partial<Opportunity>) {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    // TODO random boolean
    const data = {
      id: faker.datatype.uuid(),
      title: faker.lorem.words(2),
      isPublic: true,
      isExternal: false,
      isValidated: true,
      isArchived: false,
      company: faker.company.companyName(2),
      companyDescription: faker.lorem.paragraphs(3),
      contactMail: null as string,
      recruiterName: faker.name.findName(),
      recruiterFirstName: faker.name.findName(),
      recruiterMail: faker.internet.email(),
      recruiterPhone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      recruiterPosition: faker.lorem.words(2),
      department: faker.random.arrayElement(Departments).name,
      date: moment().toISOString(),
      description: faker.lorem.paragraphs(3),
      prerequisites: faker.lorem.paragraphs(3),
      skills: faker.lorem.paragraphs(3),
      contract: faker.lorem.words(2),
      endOfContract: moment().format('YYYY-MM-DD').toString(),
      startOfContract: moment().format('YYYY-MM-DD').toString(),
      isPartTime: faker.datatype.boolean(),
      beContacted: faker.datatype.boolean(),
      numberOfPositions: faker.datatype.number(),
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString(),
      message: faker.lorem.paragraphs(3),
      link: faker.lorem.words(2),
      externalOrigin: faker.lorem.words(2),
      address: faker.address.city(),
      driversLicense: faker.datatype.boolean(),
      workingHours: faker.lorem.words(2),
      salary: faker.lorem.words(2),
      otherInfo: faker.lorem.words(2),
    };
    return {
      ...data,
      ...props,
    };
  }

  async create(
    props: Partial<Opportunity> = {},
    components: Partial<Components> = {},
    insertInDB = true
  ): Promise<Opportunity> {
    const opportunityData = this.generateOpportunity(props);

    if (insertInDB) {
      const createdOpportunity = await this.opportunityModel.create(
        opportunityData,
        {
          hooks: true,
        }
      );

      await Promise.all(
        Object.keys(components).map(async (componentKey) => {
          const injectedModelName = `${componentKey.slice(
            0,
            -1
          )}Model` as InjectedModels;

          const injectedModel = this[injectedModelName] as typeof WrapperModel;

          const instances = await Promise.all(
            components[componentKey as ComponentKey].map((component) => {
              if (_.isString(component)) {
                return injectedModel.create(
                  {
                    name: component,
                  },
                  { hooks: true }
                );
              } else {
                return injectedModel.create(
                  component as Partial<WrapperModel>,
                  { hooks: true }
                );
              }
            })
          );
          await createdOpportunity.$add(componentKey, instances);
        })
      );

      this.incrTotalOppsInDB();
    }
    const dbOpportunity = await this.opportunitiesService.findOne(
      opportunityData.id
    );
    if (dbOpportunity) {
      return dbOpportunity.toJSON();
    }
    const builtOpportunity = await this.opportunityModel.build(opportunityData);
    return builtOpportunity.toJSON();
  }
}
