import { Injectable, Logger } from '@nestjs/common';
import { createLink, setApiKey } from '@short.io/client-node';

@Injectable()
export class ShortioService {
  private readonly logger = new Logger(ShortioService.name);
  private readonly domain: string;

  constructor() {
    this.domain = process.env.SHORTIO_DOMAIN;
    setApiKey(process.env.SHORTIO_API_KEY);
  }

  async shortenUrl(originalUrl: string): Promise<string> {
    try {
      const result = await createLink({
        body: {
          originalURL: originalUrl,
          domain: this.domain,
        },
      });
      return result.data?.shortURL ?? originalUrl;
    } catch (error) {
      this.logger.error(`Failed to shorten URL ${originalUrl}`, error);
      return originalUrl;
    }
  }
}
