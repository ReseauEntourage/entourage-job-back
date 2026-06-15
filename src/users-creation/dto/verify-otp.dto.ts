import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ description: 'ID of the user verifying the OTP code' })
  @IsUUID(4)
  userId: string;

  @ApiProperty({ description: '6-digit OTP code entered by the user' })
  @IsString()
  @Length(6, 6)
  code: string;
}
