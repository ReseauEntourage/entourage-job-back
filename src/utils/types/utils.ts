/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpStatus } from '@nestjs/common';
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
import { User } from 'src/users/models';

export type AnyToFix = any;
export type AnyCantFix = any;

export type RequestWithUser = Request & { user: User };

export type APIResponse<T extends (...args: Parameters<T>) => ReturnType<T>> = {
  body: Awaited<ReturnType<T>>;
  status: HttpStatus;
};

export class WrapperModel extends Model {}

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

export abstract class Factory<T> {
  create: (...args: AnyCantFix[]) => Promise<T>;
}
