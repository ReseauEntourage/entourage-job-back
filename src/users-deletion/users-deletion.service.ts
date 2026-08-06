import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { ExternalCvsService } from 'src/external-cvs/external-cvs.service';
import { S3Service } from 'src/external-services/aws/s3.service';
import { UserProfileDeletionService } from 'src/user-profile-deletion/user-profile-deletion.service';
import { UpdateUserDto } from 'src/users/dto';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class UsersDeletionService {
  constructor(
    private usersService: UsersService,
    private userProfileDeletionService: UserProfileDeletionService,
    private s3Service: S3Service,
    @Inject(forwardRef(() => ExternalCvsService))
    private externalCvsService: ExternalCvsService
  ) {}

  async findOneUser(userId: string) {
    return this.usersService.findOneWithRelations(userId);
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    return this.usersService.update(userId, updateUserDto);
  }

  async removeUser(userId: string) {
    return this.usersService.remove(userId);
  }

  async removeFiles(id: string, firstName: string, lastName: string) {
    const pdfFileName = `${firstName}_${lastName}_${id.substring(0, 8)}.pdf`;
    await this.s3Service.deleteFiles(
      `${process.env.AWSS3_FILE_DIRECTORY}${pdfFileName}`
    );
  }

  async removeUserProfile(id: string) {
    await this.userProfileDeletionService.clearProfileFieldsForDeletion(id);
    return this.userProfileDeletionService.removeByUserId(id);
  }
  async deleteCompleteUser(
    user: Pick<User, 'id' | 'firstName' | 'lastName'>
  ): Promise<{ userDeleted: number }> {
    const { id, firstName, lastName } = user;
    await this.removeFiles(id, firstName, lastName);
    // Must run before `removeUserProfile`: the profile row is needed to
    // resolve the user's CV media.
    await this.externalCvsService.deleteAllExternalCvsForUser(id);
    await this.updateUser(id, {
      firstName: 'Utilisateur',
      lastName: 'supprimé',
      email: `${Date.now()}@${uuid()}.deleted`,
      phone: null,
    });

    await this.removeUserProfile(id);

    const userDeleted = await this.removeUser(id);
    return {
      userDeleted,
    };
  }
}
