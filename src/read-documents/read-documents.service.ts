import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UsersService } from 'src/users/users.service';
import { ReadDocument } from './models';

@Injectable()
export class ReadDocumentsService {
  constructor(
    @InjectModel(ReadDocument)
    private readDocuments: typeof ReadDocument,
    private usersService: UsersService
  ) {}

  async findOneUser(userId: string) {
    return this.usersService.findOneWithRelations(userId);
  }

  async createReadDocument(UserId: string, documentName: string) {
    return this.readDocuments.create({
      UserId,
      documentName,
    });
  }
}
