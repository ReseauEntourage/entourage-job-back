import { Module } from '@nestjs/common';
import { AWSModule } from 'src/aws/aws.module';
import { CVsModule } from 'src/cvs/cvs.module';
import { OpportunitiesModule } from 'src/opportunities/opportunities.module';
import { RevisionsModule } from 'src/revisions/revisions.module';
import { UsersModule } from 'src/users/users.module';
import { UsersDeletionController } from './users-deletion.controller';
import { UsersDeletionService } from './users-deletion.service';

@Module({
  imports: [
    CVsModule,
    UsersModule,
    AWSModule,
    OpportunitiesModule,
    RevisionsModule,
  ],
  controllers: [UsersDeletionController],
  providers: [UsersDeletionService],
})
export class UsersDeletionModule {}
