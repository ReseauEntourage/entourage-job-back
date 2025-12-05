import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserPayload } from 'src/auth/guards';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { JWTUserPayload } from 'src/users/users.types';
import { ExternalCvsService } from './external-cvs.service';

@ApiTags('ExternalCvs')
@ApiBearerAuth()
@Controller('external-cv')
export class ExternalCvsController {
  constructor(
    private readonly externalCvsService: ExternalCvsService,
    private readonly userProfilesService: UserProfilesService
  ) {}

  /**
   * POST /external-cv - Uploads an external CV for the current user
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
    @UserPayload() user: JWTUserPayload
  ) {
    if (!file) {
      throw new BadRequestException();
    }

    try {
      const externalCvS3 = await this.externalCvsService.uploadExternalCV(
        user.id,
        file
      );
      const cvFile = await this.externalCvsService.findExternalCv(externalCvS3);
      return { url: cvFile };
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  /**
   * GET /external-cv/:userId - Finds the external CV for the current user
   * @param user - The current user signed in
   * @returns cvFile
   * @throws { InternalServerErrorException } - If the file could not be found
   * @throws { NotFoundException } - If the user does not have an external CV
   */
  @Get(':userId')
  async findExternalCv(@Param('userId') userId: string) {
    const userProfile = await this.userProfilesService.findOneByUserId(userId);
    if (!userProfile) {
      throw new InternalServerErrorException();
    }
    if (!userProfile.hasExternalCv) {
      throw new NotFoundException();
    }
    const cvFile = await this.externalCvsService.findExternalCv(
      `files/external-cvs/${userId}.pdf`
    );
    return { url: cvFile };
  }

  /**
   * DELETE /external-cv - Deletes the external CV for the current user
   * @param user - The current user signed in
   */
  @Delete()
  async deleteExternalCv(@UserPayload() user: JWTUserPayload) {
    await this.externalCvsService.deleteExternalCv(user.id);
  }
}
