import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Post, PostContext } from 'src/posts/models';
import { Factory } from 'src/utils/types';

/**
 * A help group discussion: a post with its help group context, created in
 * the same transaction as the lot 2 write path will do.
 */
@Injectable()
export class DiscussionFactory implements Factory<Post> {
  constructor(
    @InjectModel(Post)
    private postModel: typeof Post,
    @InjectModel(PostContext)
    private postContextModel: typeof PostContext
  ) {}

  async create(
    props: Partial<Post> & Pick<Post, 'authorId'>,
    helpGroupId: string
  ): Promise<Post> {
    const createdAt = props.createdAt ?? new Date();
    const { deletedAt, ...values } = props;
    const post = await this.postModel.sequelize.transaction(
      async (transaction) => {
        const created = await this.postModel.create(
          {
            title: faker.lorem.sentence().slice(0, 120),
            content: faker.lorem.paragraph(),
            createdAt,
            lastActivityAt: props.lastActivityAt ?? createdAt,
            ...values,
          },
          { transaction, silent: false }
        );
        await this.postContextModel.create(
          { postId: created.id, helpGroupId },
          { transaction }
        );
        if (deletedAt) {
          // Model level update: an instance update ignores `deletedAt`
          await this.postModel.update(
            { deletedAt },
            { where: { id: created.id }, transaction }
          );
        }
        return created;
      }
    );
    const dbPost = await this.postModel.findByPk(post.id, { paranoid: false });
    return dbPost.toJSON();
  }
}
