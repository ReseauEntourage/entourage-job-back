import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable } from '@nestjs/common';

export interface VersionInfo {
  release: string | null;
  version: string;
}

@Injectable()
export class VersionService {
  getVersion(): VersionInfo {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
    );

    return {
      version: packageJson.version,
      release: process.env.HEROKU_RELEASE_VERSION ?? null,
    };
  }
}
