import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/auth/guards';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyPipe } from './dto/create-company.pipe';

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
}
