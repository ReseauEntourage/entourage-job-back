import { Injectable } from '@nestjs/common';
import { User } from 'src/users/models';

@Injectable()
export class MailsServiceMock {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async sendPasswordResetLinkMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    // Mock implementation that doesn't actually send an email
    return Promise.resolve({ id: 'mock-mail-id' });
  }

  async sendNewAccountMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    token: string
  ) {
    // Mock implementation that doesn't actually send an email
    return Promise.resolve({ id: 'mock-mail-id' });
  }

  async sendWelcomeMail(
    user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>
  ) {
    // Mock implementation that doesn't actually send an email
    return Promise.resolve({ id: 'mock-mail-id' });
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
