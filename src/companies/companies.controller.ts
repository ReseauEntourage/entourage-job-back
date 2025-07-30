import {
  BadRequestException,
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
import { isEmail } from 'validator';
import { Public, UserPayload } from 'src/auth/guards';
import { User } from 'src/users/models';
import { CompaniesService } from './companies.service';
import { CompanyInvitationsService } from './company-invitations.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyPipe } from './dto/create-company.pipe';
import { InviteCollaboratorsDto } from './dto/invite-collaborators.dto';

@ApiTags('Companies')
@Throttle(20, 60)
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyInvitationsService: CompanyInvitationsService
  ) {}

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
    // Validate the provided emails
    if (inviteCollaboratorsDto.emails.length === 0) {
      throw new BadRequestException('No emails provided for invitation');
    }
    // Check if the number of emails exceeds the limit
    if (inviteCollaboratorsDto.emails.length > 100) {
      throw new BadRequestException('Too many emails provided for invitation');
    }

    // Validate each email format
    inviteCollaboratorsDto.emails.forEach((email) => {
      if (!isEmail(email)) {
        throw new BadRequestException(`Invalid email format: ${email}`);
      }
    });

    // Proceed with inviting collaborators
    return await this.companyInvitationsService.inviteCollaborators(
      user,
      companyId,
      inviteCollaboratorsDto.emails
    );
  }
}
