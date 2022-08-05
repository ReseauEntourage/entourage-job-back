/* eslint-disable @typescript-eslint/ban-ts-comment */
// eslint-disable-next-line import/no-unresolved
import faker from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as _ from 'lodash';
import { BusinessLine } from 'src/businessLines';
import { CV, CVsService, CVStatuses, CVStatusKey } from 'src/cvs';
import { Location } from 'src/locations';
import { WrapperModel } from 'src/utils/types';

const getCvStatusValues = (cvStatus: typeof CVStatuses) => {
  return Object.keys(cvStatus).map((status) => {
    return cvStatus[status as CVStatusKey].value;
  });
};

type ComponentKeys = 'businessLine' | 'location';

type PluralComponentKeys = `${ComponentKeys}s`;

export type Components = Record<
  PluralComponentKeys,
  CV[PluralComponentKeys] | string[]
>;

type ComponentKey = keyof Components;

type InjectedModels = `${ComponentKeys}Model`;

@Injectable()
export class CVFactory {
  constructor(
    @InjectModel(CV)
    private cvModel: typeof CV,
    @InjectModel(Location)
    private locationModel: typeof Location,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    private cvsService: CVsService
  ) {}

  generateCv(props: Partial<CV> = {}): Partial<CV> {
    const fakeData = {
      id: faker.datatype.uuid(),
      urlImg: `images/${props.UserId}.Progress.jpg`,
      story: faker.lorem.text(),
      location: faker.address.city(),
      availability: faker.lorem.sentence(),
      transport: faker.lorem.sentence(),
      catchphrase: faker.lorem.sentence(),
      status: getCvStatusValues(CVStatuses)[0],
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
    const cvData = this.generateCv(props);

    if (insertInDB) {
      const createdCV: CV = await this.cvModel.create(cvData);

      _.forEach(Object.keys(components), async (componentKey) => {
        const injectedModelName = `${componentKey.slice(
          0,
          -1
        )}Model` as InjectedModels;

        const injectedModel = this[injectedModelName] as typeof WrapperModel;

        if (Object.keys(injectedModel.getAttributes()).includes('CVId')) {
          // TODO after skills
          /*
            await Promise.all(
            components[componentKey as ComponentKey].map(async (component) => {
              const instance = await this[
                `${componentKey.slice(0, -1)}Model`
              ].create({
                CVId: cvDB.id,
                ...component,
              });

              // TODO Make generic
              const childrenComponentKey = 'skills';
              const childrenModelName =
                childrenComponentKey.charAt(0).toUpperCase() +
                childrenComponentKey.substring(1);
              if (
                modelName === 'Experiences' &&
                component[childrenComponentKey]
              ) {
                const childrenInstances = await Promise.all(
                  component[childrenComponentKey].map((component) => {
                    return this[`${componentKey.slice(0, -1)}Model`].create({
                      name: component,
                    });
                  })
                );
                await instance[`add${childrenModelName}`](childrenInstances);
              }
            })
          );*/
        } else {
          const instances = await Promise.all(
            components[componentKey as ComponentKey].map((component) => {
              try {
                if (_.isString(component)) {
                  return injectedModel.create({
                    name: component,
                  });
                } else {
                  return injectedModel.create(
                    component as Partial<WrapperModel>
                  );
                }
              } catch (err) {
                console.error(err);
              }
            })
          );
          try {
            await createdCV.$add(componentKey, instances);
          } catch (err) {
            console.error(err);
          }
        }
      });
      // TODO after CV_SEARCH
      /*
        await models.CV_Search.create({
          id: uuid(),
          CVId: cvDB.id,
          searchString: JSON.stringify({ ...cvFull, ...props }),
        });
      */

      return createdCV.toJSON();
    }
    const dbCV = await this.cvsService.findOne(cvData.id);
    if (dbCV) {
      return dbCV.toJSON();
    }
    const builtCV = await this.cvModel.build(cvData);
    return builtCV.toJSON();
  }
}
