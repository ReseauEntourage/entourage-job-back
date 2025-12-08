import { forwardRef, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from 'src/auth/auth.module';
import { BusinessSectorsModule } from 'src/common/business-sectors/business-sectors.module';
import { CompaniesModule } from 'src/companies/companies.module';
import { MailsModule } from 'src/mails/mails.module';
import { User } from './models';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    SequelizeModule.forFeature([User]),
    forwardRef(() => MailsModule),
    forwardRef(() => AuthModule),
    forwardRef(() => CompaniesModule),
    BusinessSectorsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, SequelizeModule],
})
export class UsersModule {}
