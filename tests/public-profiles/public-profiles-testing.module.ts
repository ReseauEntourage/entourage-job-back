import { Module } from '@nestjs/common';
import { PublicProfilesModule } from 'src/public-profiles/public-profiles.module';

@Module({
  imports: [PublicProfilesModule],
  providers: [],
  exports: [],
})
export class PublicProfilesTestingModule {}
