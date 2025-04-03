import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { BusinessSectorsController } from './business-sectors.controller';
import { BusinessSectorsService } from './business-sectors.service';
import { BusinessSector } from './models/business-sector.model';

@Module({
  imports: [SequelizeModule.forFeature([BusinessSector])],
  providers: [BusinessSectorsService],
  controllers: [BusinessSectorsController],
  exports: [SequelizeModule],
})
export class BusinessSectorsModule {}
