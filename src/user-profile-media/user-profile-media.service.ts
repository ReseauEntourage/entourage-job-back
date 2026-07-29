import fs from 'fs';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { S3File, S3Service } from 'src/external-services/aws/s3.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';

@Injectable()
export class UserProfileMediaService {
  constructor(
    private s3Service: S3Service,
    @Inject(forwardRef(() => UserProfilesService))
    private userProfilesService: UserProfilesService
  ) {}

  async updateHasPicture(userId: string, hasPicture: boolean) {
    await this.userProfilesService.updateByUserId(userId, {
      hasPicture,
    });
  }

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    const { path } = file;

    let uploadedImg: S3File;

    try {
      const fileBuffer = await sharp(path).jpeg({ quality: 75 }).toBuffer();

      uploadedImg = await this.s3Service.upload(
        fileBuffer,
        'image/jpeg',
        `${userId}.profile.jpg`
      );
      await this.updateHasPicture(userId, true);
    } catch {
      uploadedImg = null;
    } finally {
      if (fs.existsSync(path)) {
        fs.unlinkSync(path); // remove image locally after upload to S3
      }
    }
    return uploadedImg;
  }
}
