import { Module } from '@nestjs/common';
import { BusinessLinesModule } from 'src/businessLines';
import { CVsModule } from 'src/cvs';
import { LocationsModule } from 'src/locations';
import { CVBusinessLinesHelper } from './cv-businessLines.helper';
import { CVLocationsHelper } from './cv-locations.helper';
import { CVFactory } from './cv.factory';

@Module({
  imports: [CVsModule, LocationsModule, BusinessLinesModule],
  providers: [CVBusinessLinesHelper, CVLocationsHelper, CVFactory],
  exports: [CVBusinessLinesHelper, CVLocationsHelper, CVFactory],
})
export class CVsTestingModule {}
