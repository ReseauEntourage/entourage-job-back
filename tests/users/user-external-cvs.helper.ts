import path from 'path';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserExternalCvsHelper {
  getTestImagePath() {
    return path.join(process.cwd(), '/tests/test-data/pdf-test.pdf');
  }
}
