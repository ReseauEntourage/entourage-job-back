import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserPayload } from 'src/auth/guards';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User } from 'src/users/models';
import { UserExternalCvsService } from './user-external-cvs.service';

@Controller('user/current/external-cv')
export class UserExternalCvsController {
  constructor(
    private readonly userExternalCvsService: UserExternalCvsService,
    private readonly userProfilesService: UserProfilesService
  ) {}

  /**
   * POST /user/current/external-cv - Uploads an external CV for the current user
   * @param file - The file to be uploaded
   * @param user - The current user signed in
   * @returns { url: string } - The URL of the uploaded file
   * @throws { BadRequestException } - If the user is not a candidate or if no file is provided
   * @throws { InternalServerErrorException } - If the file could not be uploaded
   */
  @UseInterceptors(FileInterceptor('file', { dest: 'uploads/' }))
  @Post()
  async uploadExternalCV(
    @UploadedFile() file: Express.Multer.File,
    @UserPayload() user: User
  ) {
    if (!user.candidat) {
      throw new BadRequestException('User is not a candidate');
    }
    if (!file) {
      throw new BadRequestException();
    }

    const externalCvS3Key = await this.userExternalCvsService.uploadExternalCV(
      user.id,
      file
    );
    if (!externalCvS3Key) {
      throw new InternalServerErrorException();
    }
    const cvFile = await this.userExternalCvsService.findExternalCv(
      externalCvS3Key
    );
    if (!cvFile) {
      throw new InternalServerErrorException();
    }
    return { url: cvFile };
  }

  /**
   * GET /user/current/external-cv - Finds the external CV for the current user
   * @param user - The current user signed in
   * @returns cvFile
   * @throws { InternalServerErrorException } - If the file could not be found
   * @throws { NotFoundException } - If the user does not have an external CV
   */
  @Get()
  async findExternalCv(@UserPayload() user: User) {
    const userProfile = await this.userProfilesService.findOneByUserId(user.id);
    if (!userProfile) {
      throw new InternalServerErrorException();
    }
    if (!userProfile.gotExternalCv) {
      throw new NotFoundException();
    }
    const cvFile = await this.userExternalCvsService.findExternalCv(
      `files/external-cvs/${user.id}.pdf`
    );
    return { url: cvFile };
  }

  /**
   * DELETE /user/current/external-cv - Deletes the external CV for the current user
   * @param user - The current user signed in
   */
  @Delete()
  async deleteExternalCv(@UserPayload() user: User) {
    await this.userExternalCvsService.deleteExternalCv(user.id);
  }
}
