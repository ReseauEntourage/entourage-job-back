import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Location } from 'src/common/locations/models';

@Injectable()
export class LocationsHelper {
  constructor(
    @InjectModel(Location)
    private locationModel: typeof Location
  ) {}

  async countLocationByName(names: string | string[]) {
    if (!Array.isArray(names)) {
      names = [names];
    }
    return this.locationModel.count({
      where: {
        name: {
          [Op.or]: names,
        },
      },
    });
  }
}
