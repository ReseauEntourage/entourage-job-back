import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UsersService } from 'src/users/users.service';
import { ReadDocuments } from './models';

@Injectable()
export class ReadDocumentsService {
  constructor(
    @InjectModel(ReadDocuments)
    private readDocuments: typeof ReadDocuments,
    private usersService: UsersService
  ) {}

  async findOneUser(userId: string) {
    const user = await this.usersService.findOne(userId);
    return user;
  }

  async createReadDocument(UserId: string, documentName: string) {
    const readDocument = await this.readDocuments.create({
      UserId,
      documentName,
    });
    return readDocument;
  }
}
