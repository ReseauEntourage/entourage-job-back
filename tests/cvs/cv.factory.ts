// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as _ from 'lodash';
import moment from 'moment/moment';
import { Ambition } from 'src/common/ambitions/models';
import { BusinessLine } from 'src/common/business-lines/models';
import { Contract } from 'src/common/contracts/models';
import { Experience } from 'src/common/experiences/models';
import { Formation } from 'src/common/formations/models';
import { Language } from 'src/common/languages/models';
import { Location } from 'src/common/locations/models';
import { Passion } from 'src/common/passions/models';
import { Review } from 'src/common/reviews/models';
import { Skill } from 'src/common/skills/models';
import { CVsService } from 'src/cvs/cvs.service';
import { CV, CVSearch } from 'src/cvs/models';
import { CVStatuses } from 'src/users/users.types';
import { Factory, WrapperModel } from 'src/utils/types';

type ComponentKeys =
  | 'businessLine'
  | 'location'
  | 'skill'
  | 'contract'
  | 'language'
  | 'review'
  | 'experience'
  | 'ambition'
  | 'passion'
  | 'formation';

type PluralComponentKeys = `${ComponentKeys}s`;

export type Components = Record<
  PluralComponentKeys,
  CV[PluralComponentKeys] | string[]
>;

type ComponentKey = keyof Components;

type InjectedModels = `${ComponentKeys}Model`;

@Injectable()
export class CVFactory implements Factory<CV> {
  constructor(
    @InjectModel(CV)
    private cvModel: typeof CV,
    @InjectModel(Skill)
    private skillModel: typeof Skill,
    @InjectModel(Language)
    private languageModel: typeof Language,
    @InjectModel(Contract)
    private contractModel: typeof Contract,
    @InjectModel(Ambition)
    private ambitionModel: typeof Ambition,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    @InjectModel(Passion)
    private passionModel: typeof Passion,
    @InjectModel(Location)
    private locationModel: typeof Location,
    @InjectModel(Experience)
    private experienceModel: typeof Experience,
    @InjectModel(Formation)
    private formationModel: typeof Formation,
    @InjectModel(Review)
    private reviewModel: typeof Review,
    @InjectModel(CVSearch)
    private cvSearchModel: typeof CVSearch,
    private cvsService: CVsService
  ) {}

  generateCV(props: Partial<CV> = {}): Partial<CV> {
    const fakeData: Partial<CV> = {
      urlImg: `images/${props.UserId}.Progress.jpg`,
      story: faker.lorem.text(),
      intro: faker.lorem.text(),
      availability: faker.lorem.sentence(),
      transport: faker.lorem.sentence(),
      catchphrase: faker.lorem.sentence(),
      status: CVStatuses.NEW.value,
      version: 1,
      createdAt: moment().toDate(),
      updatedAt: moment().toDate(),
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<CV> = {},
    components: Partial<Components> = {},
    insertInDB = true
  ): Promise<CV> {
    const cvData = this.generateCV(props);

    const cvId = faker.datatype.uuid();

    if (insertInDB) {
      const createdCV = await this.cvModel.create(
        { ...cvData, id: cvId },
        { hooks: true }
      );

      await Promise.all(
        Object.keys(components).map(async (componentKey) => {
          const injectedModelName = `${componentKey.slice(
            0,
            -1
          )}Model` as InjectedModels;

          const injectedModel = this[injectedModelName] as typeof WrapperModel;

          if (Object.keys(injectedModel.getAttributes()).includes('CVId')) {
            await Promise.all(
              components[componentKey as ComponentKey].map(
                async (component) => {
                  const instance = await injectedModel.create(
                    {
                      CVId: cvId,
                      ...(component as Partial<WrapperModel>),
                    },
                    { hooks: true }
                  );

                  // TODO Make generic
                  const childrenComponentKey = 'skill' as ComponentKeys;
                  const childrenPluralComponentKey = `skills`;
                  /*  const childrenPluralComponentKey = 'skills';*/
                  const childrenInjectedModelName = `${
                    childrenComponentKey as ComponentKey
                  }Model` as InjectedModels;

                  const childrenInjectedModel = this[
                    childrenInjectedModelName
                  ] as typeof WrapperModel;

                  if (
                    (injectedModel.name === 'Experience' ||
                      injectedModel.name === 'Formation') &&
                    (component as Experience)[childrenPluralComponentKey]
                  ) {
                    const childrenInstances = await Promise.all(
                      (component as Experience)[childrenPluralComponentKey].map(
                        (component) => {
                          if (_.isString(component)) {
                            return childrenInjectedModel.create(
                              {
                                name: component,
                              },
                              { hooks: true }
                            );
                          } else {
                            return childrenInjectedModel.create(
                              component as Partial<WrapperModel>,
                              { hooks: true }
                            );
                          }
                        }
                      )
                    );
                    await instance.$add(
                      childrenPluralComponentKey,
                      childrenInstances
                    );
                  }
                }
              )
            );
          } else {
            const instances = await Promise.all(
              components[componentKey as ComponentKey].map(
                async (component) => {
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
                }
              )
            );
            await createdCV.$add(componentKey, instances);
          }
        })
      );

      await this.cvsService.generateSearchStringFromCV(cvData.UserId);
    }
    const dbCV = await this.cvsService.findOne(cvData.id || cvId);
    if (dbCV) {
      return dbCV.toJSON();
    }
    const builtCV = await this.cvModel.build(cvData);
    const { id, ...builtCVWithoutId } = builtCV.toJSON();
    return builtCVWithoutId as CV;
  }
}
