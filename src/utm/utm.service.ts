import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Utm } from './models';

@Injectable()
export class UtmService {
  constructor(
    @InjectModel(Utm)
    private utmModel: typeof Utm
  ) {}

  async create(createUtmDto: Partial<Utm>) {
    return this.utmModel.create(createUtmDto, {
      hooks: true,
    });
  }
}
