// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as _ from 'lodash';
import moment from 'moment';
import phone from 'phone';
import { ExternalOfferOriginFilters } from '../../src/opportunities/opportunities.types';
import { BusinessLine } from 'src/common/businessLines/models';
import { ContractFilters } from 'src/common/contracts/contracts.types';
import { Departments } from 'src/common/locations/locations.types';
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

  generateOpportunity(props: Partial<Opportunity>): Partial<Opportunity> {
    const fakePhoneNumber = faker.phone.phoneNumber('+336 ## ## ## ##');

    const fakeData: Partial<Opportunity> = {
      title: faker.lorem.words(2),
      isPublic: faker.datatype.boolean(),
      isExternal: faker.datatype.boolean(),
      isValidated: faker.datatype.boolean(),
      isArchived: faker.datatype.boolean(),
      company: faker.company.companyName(2),
      companyDescription: faker.lorem.paragraphs(3),
      contactMail: '',
      recruiterName: faker.name.findName(),
      recruiterFirstName: faker.name.findName(),
      recruiterMail: faker.internet.email(),
      recruiterPhone: phone(fakePhoneNumber, { country: 'FRA' }).phoneNumber,
      recruiterPosition: faker.lorem.words(2),
      department: faker.random.arrayElement(Departments).name,
      date: moment().toDate(),
      description: faker.lorem.paragraphs(3),
      prerequisites: faker.lorem.paragraphs(3),
      skills: faker.lorem.paragraphs(3),
      contract: faker.random.arrayElement(ContractFilters).value,
      endOfContract: moment().toDate(),
      startOfContract: moment().toDate(),
      isPartTime: faker.datatype.boolean(),
      beContacted: faker.datatype.boolean(),
      numberOfPositions: faker.datatype.number(),
      message: faker.lorem.paragraphs(3),
      link: faker.lorem.words(2),
      externalOrigin: faker.random.arrayElement(ExternalOfferOriginFilters)
        .value,
      address: faker.address.city(),
      driversLicense: faker.datatype.boolean(),
      workingHours: faker.lorem.words(2),
      salary: faker.lorem.words(2),
      otherInfo: faker.lorem.words(2),
      createdAt: moment().toDate(),
      updatedAt: moment().toDate(),
      createdBy: faker.datatype.uuid(),
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<Opportunity> = {},
    components: Partial<Components> = {},
    insertInDB = true
  ): Promise<Opportunity> {
    const opportunityData = this.generateOpportunity(props);
    const opportunityId = faker.datatype.uuid();
    if (insertInDB) {
      const createdOpportunity = await this.opportunityModel.create(
        { ...opportunityData, id: opportunityId },
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
    }
    const dbOpportunity = await this.opportunitiesService.findOne(
      opportunityData.id || opportunityId
    );
    if (dbOpportunity) {
      return dbOpportunity.toJSON();
    }
    const builtOpportunity = await this.opportunityModel.build(opportunityData);
    const { id, ...builtOpportunityWithoutId } = builtOpportunity.toJSON();
    return builtOpportunityWithoutId as Opportunity;
  }
}
