import { Controller, Post } from '@nestjs/common';
import { RequireApiKey } from 'src/api-keys/decorators';
import { Public } from 'src/auth/guards';
import { CronService } from './cron.service';

@RequireApiKey()
@Public()
@Controller('cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Post('/prepare-recommendation-mails')
  async prepareRecommendationMails() {
    return this.cronService.prepareRecommendationMails();
  }
}
