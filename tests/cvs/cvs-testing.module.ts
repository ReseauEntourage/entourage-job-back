import { Module } from '@nestjs/common';
import { BusinessLinesModule } from 'src/businessLines/businessLines.module';
import { CVsModule } from 'src/cvs/cvs.module';
import { LocationsModule } from 'src/locations/locations.module';
import { CVBusinessLinesHelper } from './cv-businessLines.helper';
import { CVLocationsHelper } from './cv-locations.helper';
import { CVFactory } from './cv.factory';

@Module({
  imports: [CVsModule, LocationsModule, BusinessLinesModule],
  providers: [CVBusinessLinesHelper, CVLocationsHelper, CVFactory],
  exports: [CVBusinessLinesHelper, CVLocationsHelper, CVFactory],
})
export class CVsTestingModule {}
