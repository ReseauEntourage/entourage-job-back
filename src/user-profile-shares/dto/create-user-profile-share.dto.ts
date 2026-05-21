import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ShareChannel } from '../models/user-profile-share.model';

export class CreateUserProfileShareDto {
  @IsUUID(4)
  sharedUserId: string;

  @IsUUID(4)
  @IsOptional()
  sharingUserId?: string;

  @IsEnum(['linkedin', 'whatsapp'])
  channel: ShareChannel;

  @IsString()
  @IsOptional()
  postUrl?: string;
}
