import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DestroyOptions } from 'sequelize/types/model';
import { UserCandidat } from 'src/users/models/user-candidat.model';
import { User } from 'src/users/models/user.model';

@Injectable()
export class DatabaseHelper {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(UserCandidat)
    private userCandidatModel: typeof UserCandidat
  ) {}

  async resetTestDB() {
    const destroyOptions: DestroyOptions = {
      where: {},
      truncate: true,
      cascade: true,
    };
    try {
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
