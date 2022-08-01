import { Injectable } from '@nestjs/common';
import { CV } from 'src/cvs';
import { Components, CVFactory } from './cv.factory';

@Injectable()
export class CVHelper {
  constructor(private cvFactory: CVFactory) {}

  async createCvWithAssociations(
    props: Partial<CV> = {},
    components: Partial<Components> = {}
  ) {
    let fullCv: Partial<CV> = {};

    fullCv = {
      ...fullCv,
      ...props,
    };
    const cv = await this.cvFactory.create(fullCv, components, true);

    return {
      userId: fullCv.UserId,
      cv,
    };
  }
}
