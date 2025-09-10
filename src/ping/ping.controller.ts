import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/auth/guards';
import { PingService } from './ping.service';

@ApiTags('Ping')
@ApiBearerAuth()
@Controller('ping')
export class PingController {
  constructor(private readonly pingService: PingService) {}

  @Public()
  @Get()
  async ping() {
    return this.pingService.ping();
  }

  @Public()
  @Get('db')
  async pingDb() {
    return this.pingService.pingDb();
  }
}
