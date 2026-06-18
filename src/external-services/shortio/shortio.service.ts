import { Injectable, Logger } from '@nestjs/common';
import { createLink, setApiKey } from '@short.io/client-node';

@Injectable()
export class ShortioService {
  private readonly logger = new Logger(ShortioService.name);
  private readonly domain: string;

  constructor() {
    const domain = process.env.SHORTIO_DOMAIN;
    const apiKey = process.env.SHORTIO_API_KEY;
    if (!domain || !apiKey) {
      throw new Error('Short.io is not configured (SHORTIO_DOMAIN/SHORTIO_API_KEY)');
    }
    this.domain = domain;
    setApiKey(apiKey);
  }

  async shortenUrl(originalUrl: string): Promise<string> {
    try {
      const result = await createLink({
        body: {
          originalURL: originalUrl,
          domain: this.domain,
        },
      });
      if (!result.data || !result.data.shortURL) {
        this.logger.error(
          `Invalid response from Short.io API for URL ${originalUrl}: ${JSON.stringify(
            result
          )}`
        );
        throw new Error('Invalid response from Short.io API');
      }
      return result.data.shortURL;
    } catch (error) {
      this.logger.error(`Failed to shorten URL ${originalUrl}`, error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to shorten URL: ${message}`);
    }
  }
}
