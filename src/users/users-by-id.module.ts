import { Module } from '@nestjs/common';
import { UsersByIdController } from './users-by-id.controller';
import { UsersModule } from './users.module';

/**
 * Import this module LAST in the application module (see
 * `UsersByIdController`).
 */
@Module({
  imports: [UsersModule],
  controllers: [UsersByIdController],
})
export class UsersByIdModule {}
