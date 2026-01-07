/* eslint-disable @typescript-eslint/ban-types */
import {
  ArgumentMetadata,
  BadRequestException,
  PipeTransform,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InviteCollaboratorsDto } from './invite-collaborators.dto';

export class inviteCollaboratorsPipe
  implements
    PipeTransform<InviteCollaboratorsDto, Promise<InviteCollaboratorsDto>>
{
  async transform(
    value: InviteCollaboratorsDto,
    { metatype }: ArgumentMetadata
  ): Promise<InviteCollaboratorsDto> {
    if (!metatype || !inviteCollaboratorsPipe.toValidate(metatype)) {
      return value;
    }
    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException();
    }
    return value;
  }

  private static toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }
}
