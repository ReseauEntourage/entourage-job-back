import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from 'src/users/models';
import { AssistantToolsController } from './assistant-tools.controller';
import { AssistantToolsService } from './assistant-tools.service';

@Module({
  imports: [SequelizeModule.forFeature([User])],
  controllers: [AssistantToolsController],
  providers: [AssistantToolsService],
})
export class AssistantToolsModule {}
