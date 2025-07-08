import { execFile, ExecFileException } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';

import { ProfileGenerationService } from '../producers/profile-generation.service';
import { detectPdftocairoPath } from 'src/cvs/cvs.utils';
import { OpenAiService } from 'src/external-services/openai/openai.service';
import { PusherService } from 'src/external-services/pusher/pusher.service';
import {
  PusherChannels,
  PusherEvents,
} from 'src/external-services/pusher/pusher.types';
import {
  Jobs,
  Queues,
  GenerateProfileFromPDFJob,
} from 'src/queues/queues.types';

@Processor(Queues.PROFILE_GENERATION)
@Injectable()
export class ProfileGeneratorProcessor {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly pusherService: PusherService,
    private readonly profileGenerationService: ProfileGenerationService
  ) {}

  @Process(Jobs.GENERATE_PROFILE_FROM_PDF)
  async handleProfileGeneration(job: Job<GenerateProfileFromPDFJob>) {
    const { pdfPath, userProfileId, fileHash } = job.data;

    try {
      job.progress(10);

      const base64Images = await this.convertPDFToImages(pdfPath);

      job.progress(30);

      // Traitement long avec OpenAI
      const extractedCVData = await this.openAiService.extractCVFromImages(
        base64Images
      );

      job.progress(80);

      await this.profileGenerationService.saveExtractedCVData(
        userProfileId,
        extractedCVData,
        fileHash
      );

      job.progress(90);

      // Notifier l'utilisateur que le traitement est terminé
      await this.pusherService.sendEvent(
        PusherChannels.PROFILE_GENERATION,
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        {
          success: true,
          jobId: job.id,
          userProfileId,
        }
      );

      job.progress(100);

      return;
    } catch (error: unknown) {
      await this.pusherService.sendEvent(
        PusherChannels.PROFILE_GENERATION,
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        {
          success: false,
          error:
            error instanceof Error ? error.message : 'Une erreur est survenue',
          jobId: job.id,
          userProfileId,
        }
      );
      throw error;
    }
  }

  /**
   * Convertit un contenu PDF en base64 en un tableau d'images base64
   * Cette méthode est un placeholder - utilisez votre propre implémentation
   */
  private async convertPDFToImages(pdfPath: string): Promise<string[]> {
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const outputPrefix = 'converted';
    const pdftocairoPath = detectPdftocairoPath();

    return new Promise((resolve, reject) => {
      // Convertir toutes les pages du PDF
      const args = [
        '-png',
        '-scale-to',
        '1024',
        pdfPath,
        path.join(outputDir, outputPrefix),
      ];

      execFile(pdftocairoPath, args, async (error: ExecFileException) => {
        if (error)
          return reject(new Error(`Erreur conversion PDF: ${error.message}`));

        try {
          // Lire tous les fichiers générés dans le répertoire
          const files = fs
            .readdirSync(outputDir)
            .filter(
              (file) => file.startsWith(outputPrefix) && file.endsWith('.png')
            )
            .sort((a, b) => {
              // Format attendu: "converted-[page].png"
              const pageA = parseInt(a.split('-')[1]?.replace('.png', ''));
              const pageB = parseInt(b.split('-')[1]?.replace('.png', ''));
              return pageA - pageB;
            });

          const pagesBase64: string[] = [];

          // Lire chaque fichier et le convertir en base64
          for (const file of files) {
            const filePath = path.join(outputDir, file);
            const buffer = fs.readFileSync(filePath);
            pagesBase64.push(buffer.toString('base64'));

            // Supprimer le fichier après utilisation
            fs.unlinkSync(filePath);
          }

          resolve(pagesBase64);
        } catch (err) {
          reject(new Error(`Erreur traitement des images: ${err}`));
        }
      });
    });
  }
}
