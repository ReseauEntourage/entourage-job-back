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
import { DocumentsTypes, DocumentsTypesArray } from './read-documents.types';

@Controller('read-documents')
export class ReadDocumentsController {
  constructor(private readonly readDocumentsService: ReadDocumentsService) {}

  @Self('params.userId')
  @UseGuards(SelfGuard)
  @Post('/read/:userId')
  async createReadDocument(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body('documentName') documentName: DocumentsTypes
  ) {
    const user = await this.readDocumentsService.findOneUser(userId);

    if (!user) {
      throw new NotFoundException();
    }

    if (!DocumentsTypesArray.includes(documentName)) {
      throw new BadRequestException();
    }

    const createdReadDocument =
      await this.readDocumentsService.createReadDocument(userId, documentName);

    return createdReadDocument;
  }
}
