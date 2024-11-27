import { Injectable } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { ExternalDatabasesService } from 'src/external-databases/external-databases.service';
import { MailsService } from 'src/mails/mails.service';
import { UserProfile } from 'src/user-profiles/models';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { User, UserCandidat } from 'src/users/models';
import { UserCandidatsService } from 'src/users/user-candidats.service';
import { UsersService } from 'src/users/users.service';
import { CreateUserRegistrationDto } from './dto';

@Injectable()
export class UsersCreationService {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private userProfilesService: UserProfilesService,
    private userCandidatsService: UserCandidatsService,
    private mailsService: MailsService,
    private externalDatabasesService: ExternalDatabasesService
  ) {}

  async createUser(createUserDto: Partial<User>) {
    return this.usersService.create(createUserDto);
  }

  async createExternalDBUser(
    createdUserId: string,
    otherInfo: Pick<
      CreateUserRegistrationDto,
      | 'program'
      | 'workingRight'
      | 'campaign'
      | 'birthDate'
      | 'nationality'
      | 'accommodation'
      | 'hasSocialWorker'
      | 'resources'
      | 'studiesLevel'
      | 'workingExperience'
      | 'jobSearchDuration'
      | 'workingRight'
      | 'gender'
    >
  ) {
    return this.externalDatabasesService.createExternalDBUser(
      createdUserId,
      otherInfo
    );
  }

  async findOneUser(id: string) {
    return this.usersService.findOne(id);
  }

  async findOneUserCandidatByCandidateId(candidateId: string) {
    return this.userCandidatsService.findOneByCandidateId(candidateId);
  }

  async loginUser(user: User) {
    return this.authService.login(user);
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

  async sendWelcomeMail(user: User) {
    return this.mailsService.sendWelcomeMail(user);
  }

  async sendVerificationMail(user: User) {
    const token = await this.authService.generateVerificationToken(user);
    return this.mailsService.sendVerificationMail(user, token);
  }

  async sendFinalizeAccountReferedUser(candidate: User, referer: User) {
    const token = await this.authService.generateVerificationToken(candidate);
    return this.mailsService.sendReferedCandidateFinalizeAccountMail(
      referer,
      candidate,
      token
    );
  }

  async sendOnboardingJ3ProfileCompletionMail(user: User) {
    return this.mailsService.sendOnboardingJ3ProfileCompletionMail(user);
  }

  async sendOnboardingJ1BAOMail(user: User) {
    return this.mailsService.sendOnboardingJ1BAOMail(user);
  }

  async sendMailsAfterMatching(candidateId: string) {
    return this.usersService.sendMailsAfterMatching(candidateId);
  }

  async sendAdminNewRefererNotificationMail(referer: User) {
    return this.mailsService.sendAdminNewRefererNotificationMail(referer);
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

  async updateAllUserCandidatLinkedUserByCandidateId(
    candidatesAndCoachesIds: { candidateId: string; coachId: string }[]
  ): Promise<UserCandidat[]> {
    return this.userCandidatsService.updateAllLinkedCoachesByCandidatesIds(
      candidatesAndCoachesIds
    );
  }

  async updateUserProfileByUserId(
    userId: string,
    updateUserProfileDto: Partial<UserProfile>
  ) {
    return this.userProfilesService.updateByUserId(
      userId,
      updateUserProfileDto
    );
  }
}
