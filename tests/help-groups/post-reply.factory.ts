import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PostReply } from 'src/posts/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class PostReplyFactory implements Factory<PostReply> {
  constructor(
    @InjectModel(PostReply)
    private postReplyModel: typeof PostReply
  ) {}

  async create(
    props: Partial<PostReply> & Pick<PostReply, 'postId' | 'authorId'>
  ): Promise<PostReply> {
    const { deletedAt, ...values } = props;
    const reply = await this.postReplyModel.create({
      content: faker.lorem.paragraph(),
      ...values,
    });
    if (deletedAt) {
      // Model level update: an instance update ignores `deletedAt`
      await this.postReplyModel.update(
        { deletedAt },
        { where: { id: reply.id } }
      );
    }
    const dbReply = await this.postReplyModel.findByPk(reply.id, {
      paranoid: false,
    });
    return dbReply.toJSON();
  }
}
