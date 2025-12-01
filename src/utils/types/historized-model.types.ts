import {
  AfterCreate,
  AfterDestroy,
  AfterUpdate,
  AllowNull,
  BeforeCreate,
  BeforeDestroy,
  BeforeUpdate,
  Column,
  Default,
  Model,
} from 'sequelize-typescript';
import {
  createAfterHook,
  createBeforeHook,
} from 'src/revisions/revisions.utils';

export class HistorizedModel extends Model {
  @AllowNull(true)
  @Default(0)
  @Column
  revision: number;

  @BeforeCreate
  static async papertrailBeforeCreate(userToCreate: HistorizedModel) {
    await createBeforeHook(userToCreate, 'create');
  }

  @BeforeUpdate
  static async papertrailBeforeUpdate(userToUpdate: HistorizedModel) {
    await createBeforeHook(userToUpdate, 'update');
  }

  @BeforeDestroy
  static async papertrailBeforeDestroy(userToDestroy: HistorizedModel) {
    await createBeforeHook(userToDestroy, 'destroy');
  }

  @AfterCreate
  static async papertrailAfterCreate(createdUser: HistorizedModel) {
    await createAfterHook(createdUser, 'create');
  }

  @AfterUpdate
  static async papertrailAfterUpdate(updatedUser: HistorizedModel) {
    await createAfterHook(updatedUser, 'update');
  }

  @AfterDestroy
  static async papertrailAfterDestroy(destroyedUser: HistorizedModel) {
    await createAfterHook(destroyedUser, 'destroy');
  }
}
