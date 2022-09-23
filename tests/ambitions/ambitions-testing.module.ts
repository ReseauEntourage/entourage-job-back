import { Module } from '@nestjs/common';
import { AmbitionsModule } from 'src/common/ambitions/ambitions.module';
import { AmbitionsHelper } from './ambitions.helper';

@Module({
  imports: [AmbitionsModule],
  providers: [AmbitionsHelper],
  exports: [AmbitionsHelper],
})
export class AmbitionsTestingModule {}
