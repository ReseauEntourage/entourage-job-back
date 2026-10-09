import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PostRevision } from 'src/posts/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class PostRevisionFactory implements Factory<PostRevision> {
  constructor(
    @InjectModel(PostRevision)
    private postRevisionModel: typeof PostRevision
  ) {}

  /**
   * Exactly one of `postId` or `replyId` must be given (DB CHECK constraint).
   */
  async create(props: Partial<PostRevision>): Promise<PostRevision> {
    const revision = await this.postRevisionModel.create({
      content: faker.lorem.paragraph(),
      ...props,
    });
    return revision.toJSON();
  }
}
