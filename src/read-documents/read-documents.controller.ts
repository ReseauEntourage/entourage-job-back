import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Self, SelfGuard } from 'src/users/guards';
import { ReadDocumentsService } from './read-documents.service';
import { DocumentType, DocumentsTypesArray } from './read-documents.types';

@Controller('readDocuments')
export class ReadDocumentsController {
  constructor(private readonly readDocumentsService: ReadDocumentsService) {}

  @Self('params.userId')
  @UseGuards(SelfGuard)
  @Post('/read/:userId')
  async createReadDocument(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body('documentName') documentName: DocumentType
  ) {
    const user = await this.readDocumentsService.findOneUser(userId);

    if (!user) {
      throw new NotFoundException();
    }

    if (!DocumentsTypesArray.includes(documentName)) {
      throw new BadRequestException();
    }

    return this.readDocumentsService.createReadDocument(userId, documentName);
  }
}
