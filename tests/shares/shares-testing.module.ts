import { Module } from '@nestjs/common';
import { SharesModule } from 'src/shares/shares.module';
import { SharesHelper } from './shares.helper';

@Module({
  imports: [SharesModule],
  providers: [SharesHelper],
  exports: [SharesHelper],
})
export class SharesTestingModule {}
