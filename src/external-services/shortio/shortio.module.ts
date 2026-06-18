import { Module } from '@nestjs/common';
import { ShortioService } from './shortio.service';

@Module({
  providers: [ShortioService],
  exports: [ShortioService],
})
export class ShortioModule {}
