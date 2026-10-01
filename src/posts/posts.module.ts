import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Post, PostContext, PostReaction, PostReply } from './models';
import { PostsService } from './posts.service';

/**
 * Generic publications (posts, replies, reactions) and their reusable reads.
 * Exposes no route: consumers (e.g. help groups) own their routes.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([Post, PostContext, PostReply, PostReaction]),
  ],
  providers: [PostsService],
  exports: [SequelizeModule, PostsService],
})
export class PostsModule {}
