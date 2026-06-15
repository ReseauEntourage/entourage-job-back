import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ description: 'ID of the user to send the OTP code to' })
  @IsUUID(4)
  userId: string;
}
