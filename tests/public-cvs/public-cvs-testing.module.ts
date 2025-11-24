import { Module } from '@nestjs/common';
import { PublicCVsModule } from 'src/public-cv/public-cvs.module';

@Module({
  imports: [PublicCVsModule],
  providers: [],
  exports: [],
})
export class PublicCVsTestingModule {}
