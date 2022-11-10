import { Module } from '@nestjs/common';
import { PleziService } from './plezi.service';

@Module({
  providers: [PleziService],
  exports: [PleziService],
})
export class PleziModule {}
