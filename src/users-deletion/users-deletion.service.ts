import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { S3Service } from 'src/external-services/aws/s3.service';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UpdateUserDto } from 'src/users/dto';
import { User } from 'src/users/models';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class UsersDeletionService {
  constructor(
    private usersService: UsersService,
    private userProfilesService: UserProfilesService,
    private s3Service: S3Service
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
    await this.userProfilesService.updateByUserId(id, {
      currentJob: null,
      description: null,
      introduction: null,
    });
    return this.userProfilesService.removeByUserId(id);
  }

  async deleteCompleteUser(user: User): Promise<{ userDeleted: number }> {
    const { id, firstName, lastName } = user.toJSON();

    await this.removeFiles(id, firstName, lastName);

    await this.updateUser(id, {
      firstName: 'Utilisateur',
      lastName: 'supprimé',
      email: `${Date.now()}@${uuid()}.deleted`,
      phone: null,
      address: null,
    });

    await this.removeUserProfile(id);

    const userDeleted = await this.removeUser(id);
    return {
      userDeleted,
    };
  }
}
