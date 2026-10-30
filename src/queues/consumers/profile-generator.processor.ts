import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Job, Queue } from 'bullmq';
import { ProfileGenerationService } from '../../profile-generation/profile-generation.service';
import { isTwoPassExtractionEnabled } from 'src/external-services/cv-extraction/cv-extraction.config';
import { CvExtractionService } from 'src/external-services/cv-extraction/cv-extraction.service';
import { AiFeature } from 'src/external-services/llm-observability/ai-feature.enum';
import { totalPagesBytes } from 'src/external-services/llm-observability/cv-trace';
import { traceAiWorkflow } from 'src/external-services/llm-observability/llm-observability';
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
import { WORKER_METRICS_OPTIONS } from 'src/queues/queues.utils';
import { detectPdftocairoPath } from 'src/utils/misc/pdf-to-cairo';

const CANCELLATION_CHECK_INTERVAL_MS = 2000;

class ProfileGenerationCancelledError extends Error {}

@Processor(Queues.PROFILE_GENERATION, {
  metrics: WORKER_METRICS_OPTIONS,
})
@Injectable()
export class ProfileGeneratorProcessor extends WorkerHost {
  private readonly logger = new Logger(ProfileGeneratorProcessor.name);

  constructor(
    private readonly cvExtractionService: CvExtractionService,
    private readonly pusherService: PusherService,
    private readonly profileGenerationService: ProfileGenerationService,
    @InjectQueue(Queues.PROFILE_GENERATION)
    private readonly profileGenerationQueue: Queue
  ) {
    super();
  }

  /**
   * Relit l'état du job depuis Redis (le worker peut tourner sur une instance
   * différente de celle ayant reçu la requête d'annulation).
   */
  private async isJobCancelled(jobId: string | undefined): Promise<boolean> {
    if (!jobId) {
      return false;
    }
    const freshJob = await this.profileGenerationQueue.getJob(jobId);
    return !!freshJob?.data?.cancelled;
  }

  async process(job: Job): Promise<void> {
    if (job.name === Jobs.GENERATE_PROFILE_FROM_PDF) {
      return this.handleProfileGeneration(
        job as Job<GenerateProfileFromPDFJob>
      );
    }
    throw new Error(`Unknown job type: ${job.name}`);
  }

  async handleProfileGeneration(job: Job<GenerateProfileFromPDFJob>) {
    const { s3Key, userProfileId, userId, fileHash } = job.data;
    let tempPdfPath = '';
    let cancelledDuringWait = false;
    let cancellationCheckInterval: ReturnType<typeof setInterval> | undefined;

    try {
      await job.updateProgress(10);

      // Build the S3 URL — `s3Key` is the full key stored in database
      const pdfUrl = `https://${process.env.AWSS3_BUCKET_NAME}.s3.eu-west-3.amazonaws.com/${s3Key}`;

      // A text already read from this very file (same hash, current reading
      // instructions) spares the download, the conversion and the reading: only
      // the profile is built again
      const reusableTranscript = isTwoPassExtractionEnabled()
        ? await this.profileGenerationService.getReusableTranscript(
            userProfileId,
            fileHash
          )
        : null;

      let base64Images: string[] = [];
      if (!reusableTranscript) {
        // Télécharger le PDF depuis S3 directement dans le worker
        const tempDir = process.platform === 'darwin' ? '/tmp' : os.tmpdir();
        fs.mkdirSync(tempDir, { recursive: true });

        // Utiliser un nom de fichier unique pour éviter les conflits - ne peut pas utiliser le userId
        const uniqueId = `${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 8)}`;
        tempPdfPath = path.join(tempDir, `${uniqueId}.pdf`);

        const response = await axios.get(pdfUrl, {
          responseType: 'arraybuffer',
        });
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

        base64Images = await this.convertPDFToImages(tempPdfPath);
      }

      await job.updateProgress(30);

      // Traitement long avec le LLM : annulation coopérative via un signal
      // relu périodiquement depuis les métadonnées du job (Redis).
      const abortController = new AbortController();
      cancellationCheckInterval = setInterval(() => {
        void this.isJobCancelled(job.id).then((isCancelled) => {
          if (isCancelled) {
            cancelledDuringWait = true;
            abortController.abort();
          }
        });
      }, CANCELLATION_CHECK_INTERVAL_MS);

      const extraction = await traceAiWorkflow(
        {
          feature: AiFeature.CV_EXTRACTION,
          name: 'cv-extraction',
          // The S3 key lets an operator find the source file of a trace by hand.
          // Neither the pages nor a link to the file are sent to Datadog.
          tags: { userProfileId, fileHash, s3Key },
        },
        async ({ setOutcome, annotate }) => {
          annotate({
            metadata: reusableTranscript
              ? { reusedTranscript: true, textChars: reusableTranscript.length }
              : {
                  pageCount: base64Images.length,
                  imagesBytes: totalPagesBytes(base64Images),
                },
          });
          try {
            const result = reusableTranscript
              ? await this.cvExtractionService.buildCVFromTranscript(
                  reusableTranscript,
                  abortController.signal
                )
              : await this.cvExtractionService.extractCVFromImages(
                  base64Images,
                  abortController.signal
                );
            if (cancelledDuringWait) {
              setOutcome('cancelled');
            }
            return result;
          } catch (error) {
            if (abortController.signal.aborted) {
              setOutcome('cancelled');
            }
            throw error;
          }
        }
      );

      await job.updateProgress(80);

      // Fenêtre résiduelle : l'annulation peut arriver après la réponse du LLM
      // mais avant l'écriture du profil.
      if (cancelledDuringWait || (await this.isJobCancelled(job.id))) {
        throw new ProfileGenerationCancelledError();
      }

      await this.profileGenerationService.saveExtractedCVData(
        userProfileId,
        extraction.data,
        fileHash,
        extraction.transcript
      );

      await this.profileGenerationService.populateUserProfileFromCVData(
        userId,
        extraction.data
      );

      await job.updateProgress(90);

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

      await job.updateProgress(100);

      return;
    } catch (error: unknown) {
      const isCancelled =
        cancelledDuringWait ||
        error instanceof ProfileGenerationCancelledError ||
        (await this.isJobCancelled(job.id));

      if (!isCancelled) {
        this.logger.error(
          `[ProfileGeneration] Échec technique de la génération de profil (jobId=${
            job.id
          }, userId=${userId}): ${
            error instanceof Error ? error.message : String(error)
          }`,
          error instanceof Error ? error.stack : undefined
        );
      }

      await this.pusherService.sendEvent(
        `${PusherChannels.PROFILE_GENERATION}-${userId}`,
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        {
          success: false,
          reason: isCancelled ? 'cancelled' : 'error',
          error: isCancelled
            ? undefined
            : error instanceof Error
              ? error.message
              : 'Une erreur est survenue',
          jobId: job.id,
          userProfileId,
        }
      );
      throw error;
    } finally {
      clearInterval(cancellationCheckInterval);
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
