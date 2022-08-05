import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DestroyOptions } from 'sequelize/types/model';
import { BusinessLine } from 'src/businessLines';
import { CV, CVBusinessLine, CVLocation } from 'src/cvs';
import { Location } from 'src/locations';
import { UserCandidat, User } from 'src/users';

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
    private cvBusinessLineModel: typeof CVBusinessLine
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
    F extends (props: Parameters<F>, ...args: Parameters<F>) => ReturnType<F>
  >(factory: F, n: number, props: Parameters<F>, ...args: Parameters<F>) {
    return Promise.all(
      Array(n)
        .fill(0)
        .map(() => {
          return factory(props, ...args);
        })
    ).catch((e) => {
      return console.error(e);
    });
  }
}
