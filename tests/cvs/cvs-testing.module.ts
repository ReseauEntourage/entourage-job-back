import { Module } from '@nestjs/common';
import { BusinessLinesModule } from 'src/businessLines/businessLines.module';
import { CVsModule } from 'src/cvs/cvs.module';
import { LocationsModule } from 'src/locations/locations.module';
import { UsersModule } from 'src/users/users.module';
import { CVBusinessLinesHelper } from './cv-businessLines.helper';
import { CVLocationsHelper } from './cv-locations.helper';
import { CVFactory } from './cv.factory';
import { CVsHelper } from './cvs.helper';

@Module({
  imports: [CVsModule, LocationsModule, BusinessLinesModule, UsersModule],
  providers: [CVBusinessLinesHelper, CVLocationsHelper, CVFactory, CVsHelper],
  exports: [CVBusinessLinesHelper, CVLocationsHelper, CVFactory],
})
export class CVsTestingModule {}
