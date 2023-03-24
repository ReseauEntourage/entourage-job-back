import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { MailsService } from 'src/mails/mails.service';
import { CreateUserDto } from 'src/users/dto';
import { User, UserCandidat } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class UsersCreationService {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private userCandidatsService: UserCandidatsService,
    private mailsService: MailsService
  ) {}

  async createUser(createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  async findOneUser(id: string) {
    return this.usersService.findOne(id);
  }

  generateRandomPasswordInJWT(expiration: string | number = '1d') {
    return this.authService.generateRandomPasswordInJWT(expiration);
  }

  async sendNewAccountMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    return this.mailsService.sendNewAccountMail(user, token);
  }

  async sendMailsAfterMatching(candidateId: string) {
    return this.usersService.sendMailsAfterMatching(candidateId);
  }

  async updateUserCandidatByCandidateId(
    candidateId: string,
    updateUserCandidatDto: Partial<UserCandidat>
  ) {
    return this.userCandidatsService.updateByCandidateId(
      candidateId,
      updateUserCandidatDto
    );
  }
}
