import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SequelizeMeta } from 'src/db/models/sequelize-meta.model';

@Injectable()
export class PingService {
  constructor(
    @InjectModel(SequelizeMeta)
    private sequelizeMetaModel: typeof SequelizeMeta
  ) {}

  async ping() {
    return 'pong';
  }

  async pingDb() {
    const lastMigration = await this.sequelizeMetaModel.findOne({
      order: [['name', 'DESC']],
    });
    if (!lastMigration) {
      throw new NotFoundException('No migrations found');
    }
    return lastMigration.name;
  }
}
