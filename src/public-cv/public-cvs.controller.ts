import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import validator from 'validator';
import { Public } from 'src/auth/guards';
import { PublicCVsService } from './public-cvs.services';

@ApiTags('PublicCVs')
@ApiBearerAuth()
@Controller('users/public-cvs')
export class PublicCVsController {
  constructor(private readonly publicCVsService: PublicCVsService) {}

  @Public()
  @Get()
  async getPublicCVs(
    @Query()
    query: {
      limit: number;
      offset: number;
      search: string;
    }
  ) {
    return this.publicCVsService.getPublicCVs(query);
  }

  @Public()
  @Get(':userId')
  async getPublicCVsByUserId(@Param('userId') userId: string) {
    const userIdIsValid = validator.isUUID(userId, 4);
    if (!userIdIsValid) {
      throw new NotFoundException('Invalid user ID format');
    }
    const publicCVDto = await this.publicCVsService.getPublicCVByUserId(userId);
    if (!publicCVDto) {
      throw new NotFoundException('Public CV not found');
    }
    return publicCVDto;
  }
}
