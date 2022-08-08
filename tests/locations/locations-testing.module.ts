import { Module } from '@nestjs/common';
import { LocationsModule } from 'src/locations';
import { LocationsHelper } from './locations.helper';

@Module({
  imports: [LocationsModule],
  providers: [LocationsHelper],
  exports: [LocationsHelper],
})
export class LocationsTestingModule {}
