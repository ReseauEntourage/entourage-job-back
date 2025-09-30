import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Job } from 'bull';
import { ProfileGenerationService } from '../../profile-generation/profile-generation.service';
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
    const { s3Key, userProfileId, userId, fileHash } = job.data;
    let tempPdfPath = '';

    try {
      job.progress(10);

      // Construire l'URL S3
      const pdfUrl = `https://${process.env.AWSS3_BUCKET_NAME}.s3.eu-west-3.amazonaws.com/${process.env.AWSS3_FILE_DIRECTORY}${s3Key}`;

      // Télécharger le PDF depuis S3 directement dans le worker
      const tempDir = process.platform === 'darwin' ? '/tmp' : os.tmpdir();
      fs.mkdirSync(tempDir, { recursive: true });

      // Utiliser un nom de fichier unique pour éviter les conflits - ne peut pas utiliser le userId
      const uniqueId = `${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      tempPdfPath = path.join(tempDir, `${uniqueId}.pdf`);

      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      if (response.status !== 200) {
        throw new Error(
          `Erreur lors du téléchargement du PDF depuis S3: ${response.status}`
        );
      }

      fs.writeFileSync(tempPdfPath, Buffer.from(response.data));

      // Vérification de l'existence du fichier PDF
      if (!fs.existsSync(tempPdfPath)) {
        console.error(
          `Le fichier PDF n'existe pas après téléchargement: ${tempPdfPath}`
        );
        throw new Error(
          `Le fichier PDF n'existe pas à l'emplacement spécifié après téléchargement: ${tempPdfPath}`
        );
      }

      const base64Images = await this.convertPDFToImages(tempPdfPath);

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

      await this.profileGenerationService.populateUserProfileFromCVData(
        userId,
        extractedCVData
      );

      job.progress(90);

      // Notifier l'utilisateur que le traitement est terminé
      await this.pusherService.sendEvent(
        `${PusherChannels.PROFILE_GENERATION}-${userId}`,

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
        `${PusherChannels.PROFILE_GENERATION}-${userId}`,
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
    } finally {
      // Nettoyage des fichiers temporaires
      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath);
        } catch (err) {
          console.error(`Erreur lors de la suppression du fichier PDF: ${err}`);
        }
      }
    }
  }

  /**
   * Convertit un contenu PDF en base64 en un tableau d'images base64
   * Cette méthode est un placeholder - utilisez votre propre implémentation
   */
  /**
   * Convertit un PDF en un tableau d'images base64
   * @param pdfPath Chemin vers le fichier PDF à convertir
   * @returns Un tableau de chaînes base64 représentant chaque page du PDF
   */
  private async convertPDFToImages(pdfPath: string): Promise<string[]> {
    // S'assurer que le chemin est absolu
    const absolutePdfPath = path.isAbsolute(pdfPath)
      ? pdfPath
      : path.resolve(process.cwd(), pdfPath);

    // Utiliser un dossier temporaire unique pour éviter les conflits
    const uniqueId = `${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    // Créer le dossier temporaire dans /tmp qui est généralement accessible en écriture
    const tempDir = process.platform === 'darwin' ? '/tmp' : os.tmpdir();
    const outputDir = path.join(tempDir, `entourage_pdf_convert_${uniqueId}`);

    try {
      // Vérifier une dernière fois que le fichier PDF existe
      if (!fs.existsSync(absolutePdfPath)) {
        throw new Error(`Le fichier PDF n'existe pas: ${absolutePdfPath}`);
      }

      // Créer le dossier de sortie temporaire
      fs.mkdirSync(outputDir, { recursive: true });

      const outputPrefix = 'converted';
      const pdftocairoPath = detectPdftocairoPath();

      return await new Promise<string[]>((resolve, reject) => {
        // Délai d'attente de 60 secondes
        const timeout = setTimeout(() => {
          reject(
            new Error('La conversion du PDF a pris trop de temps (timeout)')
          );
        }, 60000);

        // Vérifier une dernière fois que le fichier existe
        if (!fs.existsSync(absolutePdfPath)) {
          clearTimeout(timeout);
          return reject(new Error(`Fichier introuvable: ${absolutePdfPath}`));
        }

        const args = [
          '-png',
          '-scale-to',
          '1024',
          absolutePdfPath,
          path.join(outputDir, outputPrefix),
        ];

        execFile(pdftocairoPath, args, (error) => {
          clearTimeout(timeout);

          if (error) {
            return reject(
              new Error(`Erreur lors de la conversion PDF: ${error.message}`)
            );
          }

          try {
            if (!fs.existsSync(outputDir)) {
              return reject(
                new Error(
                  'Le dossier de sortie a été supprimé pendant le traitement'
                )
              );
            }

            const files = fs
              .readdirSync(outputDir)
              .filter(
                (file) => file.startsWith(outputPrefix) && file.endsWith('.png')
              )
              .sort((a, b) => {
                const pageA = parseInt(
                  a.split('-')[1]?.replace('.png', '') || '0'
                );
                const pageB = parseInt(
                  b.split('-')[1]?.replace('.png', '') || '0'
                );
                return pageA - pageB;
              });

            if (files.length === 0) {
              return reject(
                new Error("Aucune image n'a été générée à partir du PDF")
              );
            }

            const pagesBase64: string[] = [];

            for (const file of files) {
              const filePath = path.join(outputDir, file);
              if (fs.existsSync(filePath)) {
                const buffer = fs.readFileSync(filePath);
                pagesBase64.push(buffer.toString('base64'));

                try {
                  fs.unlinkSync(filePath);
                } catch {
                  // Ignorer les erreurs de suppression de fichiers
                }
              }
            }

            resolve(pagesBase64);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            reject(
              new Error(`Erreur lors du traitement des images: ${errorMsg}`)
            );
          }
        });
      });
    } finally {
      // Nettoyage: s'assurer que le dossier temporaire est supprimé
      if (fs.existsSync(outputDir)) {
        try {
          const files = fs.readdirSync(outputDir);
          for (const file of files) {
            try {
              fs.unlinkSync(path.join(outputDir, file));
            } catch {
              // Ignorer les erreurs
            }
          }

          fs.rmdirSync(outputDir);
        } catch {
          // Ignorer les erreurs de nettoyage
        }
      }
    }
  }
}
