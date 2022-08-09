import { Module } from '@nestjs/common';
import { AWSModule } from '../aws/aws.module';
import { CVsModule } from '../cvs/cvs.module';
import { UsersModule } from '../users/users.module';
import { UsersDeletionController } from './users-deletion.controller';
import { UsersDeletionService } from './users-deletion.service';

@Module({
  imports: [CVsModule, UsersModule, AWSModule],
  controllers: [UsersDeletionController],
  providers: [UsersDeletionService],
})
export class UsersDeletionModule {}
