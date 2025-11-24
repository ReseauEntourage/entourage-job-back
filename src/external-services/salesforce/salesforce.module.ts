import { Module } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
import { SalesforceService } from './salesforce.service';

@Module({
  imports: [UsersModule],
  providers: [SalesforceService],
  exports: [SalesforceService],
})
export class SalesforceModule {}
