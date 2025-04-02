import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { S3Service } from 'src/external-services/aws/s3.service';

@Injectable()
export class CVsService {
  constructor(private s3Service: S3Service) {}

  getPDFPageUrl(candidateId: string) {
    return `${process.env.FRONT_URL}/cv/pdf/${candidateId}`;
  }

  async findPDF(key: string) {
    try {
      const pdfExists = await this.s3Service.getHead(key);

      if (pdfExists) {
        return this.s3Service.getSignedUrl(key);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async generatePDFFromCV(
    candidateId: string,
    token: string,
    fileName: string
  ) {
    const response = await fetch(`${process.env.CV_PDF_GENERATION_AWS_URL}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        candidateId,
        token,
        fileName,
      }),
    });

    const responseJSON = await response.json();

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`${response.status}, ${responseJSON.message}`);
    }

    const { pdfUrl } = responseJSON as { pdfUrl: string };

    return pdfUrl;
  }

  // TODO ADAPT TO USE USERPROFILE INSTEAD OF CV

  // async sendGenerateCVPDF(
  //   candidateId: string,
  //   token: string,
  //   fileName: string
  // ) {
  //   await this.queuesService.addToWorkQueue(Jobs.GENERATE_CV_PDF, {
  //     candidateId,
  //     token,
  //     fileName,
  //   });
  // }
}
