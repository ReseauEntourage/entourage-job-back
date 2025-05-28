import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { BusinessSector } from 'src/common/business-sectors/models';
import { BusinessSectorFactory } from './business-sector.factory';

@Injectable()
export class BusinessSectorHelper {
  constructor(
    @InjectModel(BusinessSector)
    private businessSectorModel: typeof BusinessSector,
    private businessSectorFactory: BusinessSectorFactory
  ) {}

  async findOne({ name }: { name: string }) {
    return this.businessSectorModel.findOne({
      where: { name },
    });
  }

  async deleteAllBusinessSectors() {
    try {
      await this.businessSectorModel.destroy({
        where: {},
        force: true,
      });
    } catch (err) {
      console.error('Error deleting business sectors:', err);
    }
  }

  async seedBusinessSectors() {
    const businessSectors = [
      {
        name: 'Sector 1',
        value: 'S1',
      },
      {
        name: 'Sector 2',
        value: 'S2',
      },
      {
        name: 'Sector 3',
        value: 'S3',
      },
    ];

    try {
      for (const sector of businessSectors) {
        await this.businessSectorFactory.create({
          name: sector.name,
          value: sector.value,
        });
      }
    } catch (err) {
      console.error('Error seeding business sectors:', err);
    }
  }
}
