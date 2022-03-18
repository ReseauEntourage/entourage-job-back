import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DestroyOptions } from 'sequelize/types/model';
import { UserCandidat } from 'src/users/models/user-candidat.model';
import { User } from 'src/users/models/user.model';

@Injectable()
export class DatabaseHelper {
  constructor(
    @InjectModel(User)
    private userModel: User,
    @InjectModel(UserCandidat)
    private userCandidatModel: UserCandidat
  ) {}

  /**
   * Drops all the tables content
   *
   */
  async resetTestDB() {
    const destroyOptions: DestroyOptions = {
      where: {},
      truncate: true,
      cascade: true,
    };
    try {
      await UserCandidat.destroy(destroyOptions);
      await User.destroy(destroyOptions);
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Create many entities using a factory
   *
   * @param {function} factory an entity factory
   * @param {number} n the number of entities to create
   * @param props
   * @param args
   * @returns
   */
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
