import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequestWithAuthorizationHeader } from 'src/auth/auth.types';
import { getTokenFromHeaders } from 'src/auth/auth.utils';
import { S3Service } from 'src/external-services/aws/s3.service';
import { LinkedUser, LinkedUserGuard } from 'src/users/guards';
import { CVsService } from './cvs.service';
import { getPDFPaths } from './cvs.utils';

@ApiTags('CVs')
@Controller('cv')
export class CVsController {
  constructor(
    private readonly cvsService: CVsService,
    private readonly s3Service: S3Service
  ) {}

  @ApiBearerAuth()
  @LinkedUser('params.candidateId')
  @UseGuards(LinkedUserGuard)
  @Get('pdf/:candidateId')
  async findCVInPDF(
    @Param('candidateId', new ParseUUIDPipe()) candidateId: string,
    @Query('fileName') fileName: string,
    @Req()
    req: RequestWithAuthorizationHeader
  ) {
    const paths = getPDFPaths(candidateId, fileName);

    const s3Key = `${process.env.AWSS3_FILE_DIRECTORY}${paths[2]}`;

    const pdfUrl = await this.cvsService.findPDF(s3Key);

    if (!pdfUrl) {
      const createdPdfUrl = await this.cvsService.generatePDFFromCV(
        candidateId,
        getTokenFromHeaders(req),
        fileName
      );
      return {
        pdfUrl: createdPdfUrl,
      };
    }

    return { pdfUrl };
  }
}
