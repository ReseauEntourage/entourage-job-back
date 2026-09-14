import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable } from '@nestjs/common';

export interface VersionInfo {
  release: string | null;
  version: string;
}

@Injectable()
export class VersionService {
  // Read and parsed once at instantiation: the package version never changes
  // at runtime, so re-reading it from disk on every request would be
  // unnecessary blocking filesystem IO.
  private readonly appVersion: string = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
  ).version;

  getVersion(): VersionInfo {
    return {
      version: this.appVersion,
      release: process.env.HEROKU_RELEASE_VERSION ?? null,
    };
  }
}
