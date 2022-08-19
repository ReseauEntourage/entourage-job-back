import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsersModule } from 'src/users/users.module';
import { Share } from './models';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [SequelizeModule.forFeature([Share]), UsersModule],
  providers: [SharesService],
  controllers: [SharesController],
  exports: [SequelizeModule],
})
export class SharesModule {}
