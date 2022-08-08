import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth';
import { AuthHelper } from './auth.helper';

@Module({
  imports: [AuthModule],
  providers: [AuthHelper],
  exports: [AuthHelper],
})
export class AuthTestingModule {}
