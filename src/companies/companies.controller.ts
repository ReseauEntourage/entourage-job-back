import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public, UserPayload } from 'src/auth/guards';
import { User } from 'src/users/models';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyPipe } from './dto/create-company.pipe';
import { InviteCollaboratorsDto } from './dto/invite-collaborators.dto';

@ApiTags('Companies')
@Throttle(20, 60)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Public()
  @Get()
  async findAll(
    @Query('limit', new ParseIntPipe()) limit: number,
    @Query('offset', new ParseIntPipe()) offset: number,
    @Query('search') search?: string
  ) {
    return await this.companiesService.findAll(limit, offset, search);
  }

  @Public()
  @Throttle(5, 60)
  @Post()
  async create(
    @Body(new CreateCompanyPipe())
    createCompanyDto: CreateCompanyDto
  ) {
    const createdCompany = await this.companiesService.create(createCompanyDto);

    return createdCompany;
  }

  @Throttle(1, 60)
  @Post(':companyId/invite-collaborators')
  async inviteCollaborators(
    @Param('companyId') companyId: string,
    @Body() inviteCollaboratorsDto: InviteCollaboratorsDto,
    @UserPayload() user: User
  ) {
    return await this.companiesService.inviteCollaborators(
      user,
      companyId,
      inviteCollaboratorsDto
    );
  }
}
