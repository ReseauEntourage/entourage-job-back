import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/auth/guards';
import { VersionService } from './version.service';

@ApiTags('Version')
@Controller('version')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Public()
  @Get()
  getVersion() {
    return this.versionService.getVersion();
  }
}
