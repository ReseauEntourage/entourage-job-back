import { Module } from '@nestjs/common';
import { HelpGroupsModule } from 'src/help-groups/help-groups.module';
import { PostsModule } from 'src/posts/posts.module';
import { DiscussionFactory } from './discussion.factory';
import { HelpGroupMembershipFactory } from './help-group-membership.factory';
import { HelpGroupFactory } from './help-group.factory';
import { PostReactionFactory } from './post-reaction.factory';
import { PostReplyFactory } from './post-reply.factory';
import { PostRevisionFactory } from './post-revision.factory';

const factories = [
  HelpGroupFactory,
  HelpGroupMembershipFactory,
  DiscussionFactory,
  PostReplyFactory,
  PostReactionFactory,
  PostRevisionFactory,
];

@Module({
  imports: [PostsModule, HelpGroupsModule],
  providers: factories,
  exports: factories,
})
export class HelpGroupsTestingModule {}
