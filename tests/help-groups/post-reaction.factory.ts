import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { PostReaction } from 'src/posts/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class PostReactionFactory implements Factory<PostReaction> {
  constructor(
    @InjectModel(PostReaction)
    private postReactionModel: typeof PostReaction
  ) {}

  async create(
    props: Partial<PostReaction> & Pick<PostReaction, 'userId'>
  ): Promise<PostReaction> {
    const reaction = await this.postReactionModel.create({
      emoji: '💪',
      ...props,
    });
    return reaction.toJSON();
  }
}
