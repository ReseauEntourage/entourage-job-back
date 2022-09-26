import { Module } from '@nestjs/common';
import { PassionsModule } from 'src/common/passions/passions.module';
import { PassionsHelper } from './passions.helper';

@Module({
  imports: [PassionsModule],
  providers: [PassionsHelper],
  exports: [PassionsHelper],
})
export class PassionsTestingModule {}
