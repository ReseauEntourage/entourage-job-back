import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PostsModule } from 'src/posts/posts.module';
import { UsersModule } from 'src/users/users.module';
import { HelpGroupsAdminController } from './help-groups-admin.controller';
import { HelpGroupsAdminService } from './help-groups-admin.service';
import { HelpGroupsWriteGuardService } from './help-groups-write-guard.service';
import { HelpGroupsController } from './help-groups.controller';
import { HelpGroupsService } from './help-groups.service';
import { HelpGroup, HelpGroupMembership } from './models';

/**
 * Help groups ("groupes d'entraide"). Named `help-groups` to avoid any
 * confusion with `Conversation.type = 'group'` of the messaging.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([HelpGroup, HelpGroupMembership]),
    PostsModule,
    UsersModule,
  ],
  controllers: [HelpGroupsAdminController, HelpGroupsController],
  providers: [
    HelpGroupsService,
    HelpGroupsAdminService,
    HelpGroupsWriteGuardService,
  ],
  exports: [SequelizeModule, HelpGroupsService],
})
export class HelpGroupsModule {}
