import { Module } from '@nestjs/common';
import { SharesService } from './shares.service';
import { SequelizeModule } from '@nestjs/sequelize';
import { Share } from './models';
import { SharesController } from './shares.controller';

@Module({
  imports: [SequelizeModule.forFeature([Share])],
  providers: [SharesService],
  exports: [SequelizeModule],
  controllers: [SharesController],
})
export class SharesModule {}
