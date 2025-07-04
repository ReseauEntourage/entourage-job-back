import { Module } from '@nestjs/common';
import { BusinessSectorsModule } from 'src/common/business-sectors/business-sectors.module';
import { BusinessSectorFactory } from './business-sector.factory';
import { BusinessSectorHelper } from './business-sector.helper';

@Module({
  imports: [BusinessSectorsModule],
  providers: [BusinessSectorHelper, BusinessSectorFactory],
  exports: [BusinessSectorHelper, BusinessSectorFactory],
})
export class BusinessSectorsTestingModule {}
