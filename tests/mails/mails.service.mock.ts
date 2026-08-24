import { Injectable } from '@nestjs/common';
import { User } from 'src/users/models';
import { UserRole } from 'src/users/users.types';

@Injectable()
export class MailsServiceMock {
  async sendPasswordResetLinkMail(
    _user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    _token: string
  ) {
    // Mock implementation that doesn't actually send an email
    return Promise.resolve({ id: 'mock-mail-id' });
  }

  async sendNewAccountMail(
    _user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    _token: string
  ) {
    // Mock implementation that doesn't actually send an email
    return Promise.resolve({ id: 'mock-mail-id' });
  }

  async sendWelcomeMail(
    _user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>
  ) {
    // Mock implementation that doesn't actually send an email
    return Promise.resolve({ id: 'mock-mail-id' });
  }

  async sendAllElearningUnitsCompletedMail(
    _user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>
  ) {
    // Mock implementation that doesn't actually send an email
    return Promise.resolve({ id: 'mock-mail-id' });
  }

  async sendElearningCompletionReminderMail(
    _user: Pick<User, 'id' | 'firstName' | 'role' | 'zone' | 'email'>,
    _mirrorRole: UserRole
  ) {
    // Mock implementation that doesn't actually send an email
    return Promise.resolve({ id: 'mock-mail-id' });
  }
}
