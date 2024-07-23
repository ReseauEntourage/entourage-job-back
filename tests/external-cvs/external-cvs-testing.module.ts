import { Module } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [UsersModule],
  providers: [],
  exports: [],
})
export class ExternalCvsTestingModule {}
