/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  Inject,
  Injectable,
  PipeTransform,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRoles } from 'src/users/users.types';
import { RequestWithUser } from 'src/utils/types';
import { UpdateExternalOpportunityRestrictedDto } from './update-external-opportunity-restricted.dto';
import { UpdateExternalOpportunityDto } from './update-external-opportunity.dto';

@Injectable({ scope: Scope.REQUEST })
export class UpdateExternalOpportunityPipe
  implements
    PipeTransform<
      UpdateExternalOpportunityDto | UpdateExternalOpportunityRestrictedDto,
      Promise<
        UpdateExternalOpportunityDto | UpdateExternalOpportunityRestrictedDto
      >
    >
{
  constructor(@Inject(REQUEST) private request: RequestWithUser) {}

  async transform(
    value:
      | UpdateExternalOpportunityDto
      | UpdateExternalOpportunityRestrictedDto,
    { metatype }: ArgumentMetadata
  ): Promise<
    UpdateExternalOpportunityDto | UpdateExternalOpportunityRestrictedDto
  > {
    if (!metatype || !UpdateExternalOpportunityPipe.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(UpdateExternalOpportunityDto, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException();
    }

    const restrictedObject = plainToInstance(
      UpdateExternalOpportunityRestrictedDto,
      value
    );

    const { role } = this.request.user;

    const restrictedErrors = await validate(restrictedObject, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (restrictedErrors.length > 0 && role !== UserRoles.ADMIN) {
      throw new BadRequestException();
    }
    return value;
  }

  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array];
    return !types.includes(metatype);
  }
}
