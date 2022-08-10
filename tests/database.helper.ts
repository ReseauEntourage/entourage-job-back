import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DestroyOptions } from 'sequelize/types/model';
import { Factory } from '../src/utils/types';
import { BusinessLine } from 'src/businessLines/models';
import { CV, CVBusinessLine, CVLocation } from 'src/cvs/models';
import { Location } from 'src/locations/models';
import { UserCandidat, User } from 'src/users/models';
import { CVFactory } from './cvs/cv.factory';
import { UserFactory } from './users/user.factory';

@Injectable()
export class DatabaseHelper {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat,
    @InjectModel(CV)
    private cvModel: typeof CV,
    @InjectModel(Location)
    private locationModel: typeof Location,
    @InjectModel(CVLocation)
    private cvLocationModel: typeof CVLocation,
    @InjectModel(BusinessLine)
    private businessLineModel: typeof BusinessLine,
    @InjectModel(CVBusinessLine)
    private cvBusinessLineModel: typeof CVBusinessLine,
    private userFactory: UserFactory,
    private cvFactory: CVFactory
  ) {}

  async resetTestDB() {
    const destroyOptions: DestroyOptions = {
      where: {},
      truncate: true,
      cascade: true,
    };
    try {
      await this.cvLocationModel.destroy(destroyOptions);
      await this.cvBusinessLineModel.destroy(destroyOptions);
      await this.locationModel.destroy(destroyOptions);
      await this.businessLineModel.destroy(destroyOptions);
      await this.cvModel.destroy(destroyOptions);
      await this.userCandidatModel.destroy(destroyOptions);
      await this.userModel.destroy(destroyOptions);
    } catch (err) {
      console.error(err);
    }
  }

  async createEntities<
    F extends Factory<Awaited<ReturnType<F['create']>>>,
    A extends Parameters<F['create']>
  >(factory: F, n: number, ...args: A) {
    const promises: Promise<Awaited<ReturnType<F['create']>>>[] = [];
    for (let i = 0; i < n; i += 1) {
      promises.push(factory.create(...args));
    }

    return Promise.all(promises);
  }
}
