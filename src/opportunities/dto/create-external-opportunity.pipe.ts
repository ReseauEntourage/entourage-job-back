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
import { CreateExternalOpportunityRestrictedDto } from './create-external-opportunity-restricted.dto';
import { CreateExternalOpportunityDto } from './create-external-opportunity.dto';

@Injectable({ scope: Scope.REQUEST })
export class CreateExternalOpportunityPipe
  implements
    PipeTransform<
      CreateExternalOpportunityDto | CreateExternalOpportunityRestrictedDto,
      Promise<
        CreateExternalOpportunityDto | CreateExternalOpportunityRestrictedDto
      >
    >
{
  constructor(@Inject(REQUEST) private request: RequestWithUser) {}
  async transform(
    value:
      | CreateExternalOpportunityDto
      | CreateExternalOpportunityRestrictedDto,
    { metatype }: ArgumentMetadata
  ): Promise<
    CreateExternalOpportunityDto | CreateExternalOpportunityRestrictedDto
  > {
    if (!metatype || !CreateExternalOpportunityPipe.toValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(CreateExternalOpportunityDto, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException();
    }

    const restrictedObject = plainToInstance(
      CreateExternalOpportunityRestrictedDto,
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
