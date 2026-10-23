import fs from 'fs';
import {
  PusherChannels,
  PusherEvents,
} from 'src/external-services/pusher/pusher.types';
import { ProfileGeneratorProcessor } from 'src/queues/consumers/profile-generator.processor';
import { Jobs } from 'src/queues/queues.types';
import { tracer } from 'src/tracer';

const mockAxiosGet = jest.fn();
const mockExecFile = jest.fn();

// No real download and no real PDF conversion: S3 and poppler are both replaced.
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => mockAxiosGet(...args) },
}));
jest.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));
jest.mock('src/utils/misc/pdf-to-cairo', () => ({
  detectPdftocairoPath: () => '/usr/bin/pdftocairo',
}));

// The Datadog tracer is replaced: the LLM Observability spans are observed
jest.mock('src/tracer', () => ({
  tracer: { llmobs: { trace: jest.fn(), annotate: jest.fn() } },
}));
const span = { name: 'workflow-span' };
const trace = tracer.llmobs.trace as jest.Mock;
const annotate = tracer.llmobs.annotate as jest.Mock;

const JOB_DATA = {
  s3Key: 'folder/cv.pdf',
  userProfileId: 'profile-1',
  userId: 'user-1',
  fileHash: 'hash-1',
};

const CV_DATA = { description: 'Extracted description' };

describe('ProfileGeneratorProcessor', () => {
  const savedBucket = process.env.AWSS3_BUCKET_NAME;

  const buildJob = (data: Record<string, unknown> = JOB_DATA) => ({
    id: 'job-1',
    name: Jobs.GENERATE_PROFILE_FROM_PDF,
    data,
    updateProgress: jest.fn().mockResolvedValue(undefined),
  });

  const build = () => {
    const openAiService = {
      extractCVFromImages: jest
        .fn()
        .mockResolvedValue({ data: CV_DATA, transcript: null }),
      buildCVFromTranscript: jest.fn(),
    };
    const pusherService = { sendEvent: jest.fn().mockResolvedValue(undefined) };
    const profileGenerationService = {
      saveExtractedCVData: jest.fn().mockResolvedValue(undefined),
      getReusableTranscript: jest.fn().mockResolvedValue(null),
      populateUserProfileFromCVData: jest.fn().mockResolvedValue(undefined),
    };
    const profileGenerationQueue = {
      getJob: jest.fn().mockResolvedValue({ data: {} }),
    };
    const processor = new ProfileGeneratorProcessor(
      openAiService as never,
      pusherService as never,
      profileGenerationService as never,
      profileGenerationQueue as never
    );
    return {
      processor,
      openAiService,
      pusherService,
      profileGenerationService,
      profileGenerationQueue,
    };
  };

  /**
   * Replaces the pdftocairo binary: writes one PNG per given page number in the
   * output directory, as poppler would do.
   */
  const fakePoppler = (pages: number[]) => {
    mockExecFile.mockImplementation(
      (
        _command: string,
        args: string[],
        callback: (error: Error | null) => void
      ) => {
        const prefix = args[args.length - 1];
        pages.forEach((page) =>
          fs.writeFileSync(`${prefix}-${page}.png`, `page-${page}`)
        );
        callback(null);
      }
    );
  };

  beforeEach(() => {
    trace.mockReset().mockImplementation((_options, fn) => fn(span));
    annotate.mockReset();
    process.env.AWSS3_BUCKET_NAME = 'test-bucket';
    mockAxiosGet.mockReset();
    mockExecFile.mockReset();
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: new TextEncoder().encode('%PDF-1.4 fake'),
    });
    fakePoppler([1]);
  });

  afterAll(() => {
    if (savedBucket === undefined) {
      delete process.env.AWSS3_BUCKET_NAME;
    } else {
      process.env.AWSS3_BUCKET_NAME = savedBucket;
    }
  });

  describe('process', () => {
    it('handles the profile generation jobs', async () => {
      const { processor } = build();
      const spy = jest
        .spyOn(processor, 'handleProfileGeneration')
        .mockResolvedValue(undefined);
      const job = buildJob();

      await processor.process(job as never);

      expect(spy).toHaveBeenCalledWith(job);
    });

    it('rejects any other job', async () => {
      const { processor } = build();

      await expect(
        processor.process({ id: '1', name: Jobs.SEND_MAIL, data: {} } as never)
      ).rejects.toThrow(`Unknown job type: ${Jobs.SEND_MAIL}`);
    });
  });

  describe('handleProfileGeneration', () => {
    describe('two-pass extraction', () => {
      const saved = process.env.CV_EXTRACTION_TWO_PASSES;
      const TEXT =
        '# Expériences\nCuisinier depuis 2019, restauration collective';

      beforeEach(() => {
        process.env.CV_EXTRACTION_TWO_PASSES = 'true';
      });

      afterAll(() => {
        if (saved === undefined) {
          delete process.env.CV_EXTRACTION_TWO_PASSES;
        } else {
          process.env.CV_EXTRACTION_TWO_PASSES = saved;
        }
      });

      it('keeps the text read from the CV with the extracted data', async () => {
        const { processor, openAiService, profileGenerationService } = build();
        openAiService.extractCVFromImages.mockResolvedValue({
          data: CV_DATA,
          transcript: TEXT,
        });

        await processor.handleProfileGeneration(buildJob() as never);

        expect(
          profileGenerationService.getReusableTranscript
        ).toHaveBeenCalledWith('profile-1', 'hash-1');
        expect(mockAxiosGet).toHaveBeenCalled();
        expect(openAiService.buildCVFromTranscript).not.toHaveBeenCalled();
        expect(
          profileGenerationService.saveExtractedCVData
        ).toHaveBeenCalledWith('profile-1', CV_DATA, 'hash-1', TEXT);
        expect(
          profileGenerationService.populateUserProfileFromCVData
        ).toHaveBeenCalledWith('user-1', CV_DATA);
      });

      it('builds the profile again from a reusable text, without downloading or reading the CV', async () => {
        const {
          processor,
          openAiService,
          profileGenerationService,
          pusherService,
        } = build();
        profileGenerationService.getReusableTranscript.mockResolvedValue(TEXT);
        openAiService.buildCVFromTranscript.mockResolvedValue({
          data: CV_DATA,
          transcript: TEXT,
        });

        await processor.handleProfileGeneration(buildJob() as never);

        expect(mockAxiosGet).not.toHaveBeenCalled();
        expect(mockExecFile).not.toHaveBeenCalled();
        expect(openAiService.extractCVFromImages).not.toHaveBeenCalled();
        expect(openAiService.buildCVFromTranscript).toHaveBeenCalledWith(
          TEXT,
          expect.any(AbortSignal)
        );
        expect(
          profileGenerationService.saveExtractedCVData
        ).toHaveBeenCalledWith('profile-1', CV_DATA, 'hash-1', TEXT);
        expect(pusherService.sendEvent).toHaveBeenCalledWith(
          `${PusherChannels.PROFILE_GENERATION}-user-1`,
          PusherEvents.PROFILE_GENERATION_COMPLETE,
          { success: true, jobId: 'job-1', userProfileId: 'profile-1' }
        );
        expect(annotate).toHaveBeenCalledWith(
          span,
          expect.objectContaining({
            metadata: { reusedTranscript: true, textChars: TEXT.length },
          })
        );
      });

      it('reads the CV when no text can be reused (other file or older reading instructions)', async () => {
        const { processor, openAiService, profileGenerationService } = build();
        profileGenerationService.getReusableTranscript.mockResolvedValue(null);
        openAiService.extractCVFromImages.mockResolvedValue({
          data: CV_DATA,
          transcript: TEXT,
        });

        await processor.handleProfileGeneration(buildJob() as never);

        expect(mockAxiosGet).toHaveBeenCalled();
        expect(openAiService.extractCVFromImages).toHaveBeenCalledTimes(1);
        expect(openAiService.buildCVFromTranscript).not.toHaveBeenCalled();
      });

      it('does not even look for a reusable text when the two-pass extraction is off', async () => {
        process.env.CV_EXTRACTION_TWO_PASSES = 'false';
        const { processor, profileGenerationService } = build();

        await processor.handleProfileGeneration(buildJob() as never);

        expect(
          profileGenerationService.getReusableTranscript
        ).not.toHaveBeenCalled();
        expect(
          profileGenerationService.saveExtractedCVData
        ).toHaveBeenCalledWith('profile-1', CV_DATA, 'hash-1', null);
      });

      it('fails as a technical error, writing nothing, when the CV could not be read', async () => {
        const {
          processor,
          openAiService,
          profileGenerationService,
          pusherService,
        } = build();
        const failure =
          "Impossible de lire le CV à partir des images: La lecture du CV n'a produit aucun texte exploitable (0 caractères).";
        openAiService.extractCVFromImages.mockRejectedValue(new Error(failure));

        await expect(
          processor.handleProfileGeneration(buildJob() as never)
        ).rejects.toThrow('aucun texte exploitable');

        expect(
          profileGenerationService.saveExtractedCVData
        ).not.toHaveBeenCalled();
        expect(
          profileGenerationService.populateUserProfileFromCVData
        ).not.toHaveBeenCalled();
        expect(pusherService.sendEvent).toHaveBeenCalledWith(
          `${PusherChannels.PROFILE_GENERATION}-user-1`,
          PusherEvents.PROFILE_GENERATION_COMPLETE,
          expect.objectContaining({ success: false, reason: 'error' })
        );
      });

      it('reports a cancellation, and writes nothing, when the job is cancelled between the passes', async () => {
        const {
          processor,
          openAiService,
          profileGenerationQueue,
          profileGenerationService,
          pusherService,
        } = build();
        profileGenerationQueue.getJob.mockResolvedValue({
          data: { cancelled: true },
        });
        // The cancellation is noticed after the reading, before the building
        openAiService.extractCVFromImages.mockImplementation(
          (_images: string[], signal: AbortSignal) =>
            new Promise((_resolve, reject) => {
              signal.addEventListener('abort', () =>
                reject(new Error('Extraction du CV interrompue'))
              );
            })
        );

        await expect(
          processor.handleProfileGeneration(buildJob() as never)
        ).rejects.toThrow('interrompue');

        expect(
          profileGenerationService.saveExtractedCVData
        ).not.toHaveBeenCalled();
        expect(pusherService.sendEvent).toHaveBeenCalledWith(
          `${PusherChannels.PROFILE_GENERATION}-user-1`,
          PusherEvents.PROFILE_GENERATION_COMPLETE,
          expect.objectContaining({ success: false, reason: 'cancelled' })
        );
        expect(
          annotate.mock.calls
            .map(([, options]) => options.tags)
            .find((tags) => tags?.feature === 'cv_extraction')
        ).toMatchObject({ outcome: 'cancelled' });
      });

      it('cancels while the profile is being built from a reusable text', async () => {
        const {
          processor,
          openAiService,
          profileGenerationQueue,
          profileGenerationService,
        } = build();
        profileGenerationService.getReusableTranscript.mockResolvedValue(TEXT);
        profileGenerationQueue.getJob.mockResolvedValue({
          data: { cancelled: true },
        });
        openAiService.buildCVFromTranscript.mockImplementation(
          (_text: string, signal: AbortSignal) =>
            new Promise((_resolve, reject) => {
              signal.addEventListener('abort', () =>
                reject(new Error('Request aborted'))
              );
            })
        );

        await expect(
          processor.handleProfileGeneration(buildJob() as never)
        ).rejects.toThrow('Request aborted');

        expect(
          profileGenerationService.saveExtractedCVData
        ).not.toHaveBeenCalled();
      });
    });

    describe('cv-extraction trace', () => {
      const workflowAnnotation = () =>
        annotate.mock.calls.map(([, options]) => options)[0];

      it('opens a cv_extraction workflow around the extraction, pointing to the source file by its S3 key', async () => {
        fakePoppler([1, 2]);
        const { processor } = build();

        await processor.handleProfileGeneration(buildJob() as never);

        expect(trace).toHaveBeenCalledTimes(1);
        expect(trace).toHaveBeenCalledWith(
          { kind: 'workflow', name: 'cv-extraction' },
          expect.any(Function)
        );
        expect(annotate).toHaveBeenCalledWith(span, {
          tags: {
            userProfileId: 'profile-1',
            fileHash: 'hash-1',
            s3Key: 'folder/cv.pdf',
            feature: 'cv_extraction',
            outcome: 'success',
          },
          metadata: {
            pageCount: 2,
            imagesBytes:
              Buffer.from('page-1').toString('base64').length +
              Buffer.from('page-2').toString('base64').length,
          },
        });
      });

      it('tags an error outcome when the extraction fails', async () => {
        const { processor, openAiService } = build();
        openAiService.extractCVFromImages.mockRejectedValue(
          new Error('OpenAI overloaded')
        );

        await expect(
          processor.handleProfileGeneration(buildJob() as never)
        ).rejects.toThrow('OpenAI overloaded');

        expect(workflowAnnotation().tags).toMatchObject({
          feature: 'cv_extraction',
          outcome: 'error',
        });
      });

      it('tags a cancelled outcome when the job is cancelled during the extraction', async () => {
        const { processor, openAiService, profileGenerationQueue } = build();
        openAiService.extractCVFromImages.mockImplementation(
          (_images: string[], signal: AbortSignal) =>
            new Promise((_resolve, reject) => {
              signal.addEventListener('abort', () =>
                reject(new Error('Request aborted'))
              );
            })
        );
        profileGenerationQueue.getJob.mockResolvedValue({
          data: { cancelled: true },
        });

        await expect(
          processor.handleProfileGeneration(buildJob() as never)
        ).rejects.toThrow('Request aborted');

        expect(workflowAnnotation().tags).toMatchObject({
          outcome: 'cancelled',
        });
      });

      it('does not open a workflow when the CV cannot be downloaded', async () => {
        mockAxiosGet.mockResolvedValue({ status: 404, data: '' });
        const { processor } = build();

        await expect(
          processor.handleProfileGeneration(buildJob() as never)
        ).rejects.toThrow();

        expect(trace).not.toHaveBeenCalled();
      });
    });

    it('downloads the CV from S3, extracts its data from the page images and saves them', async () => {
      fakePoppler([10, 2, 1]);
      const {
        processor,
        openAiService,
        profileGenerationService,
        pusherService,
      } = build();
      const job = buildJob();

      await processor.handleProfileGeneration(job as never);

      expect(mockAxiosGet).toHaveBeenCalledWith(
        'https://test-bucket.s3.eu-west-3.amazonaws.com/folder/cv.pdf',
        { responseType: 'arraybuffer' }
      );
      // Pages are sent in numeric order, not in lexical order
      expect(openAiService.extractCVFromImages).toHaveBeenCalledWith(
        [
          Buffer.from('page-1').toString('base64'),
          Buffer.from('page-2').toString('base64'),
          Buffer.from('page-10').toString('base64'),
        ],
        expect.any(AbortSignal)
      );
      expect(profileGenerationService.saveExtractedCVData).toHaveBeenCalledWith(
        'profile-1',
        CV_DATA,
        'hash-1',
        null
      );
      expect(
        profileGenerationService.populateUserProfileFromCVData
      ).toHaveBeenCalledWith('user-1', CV_DATA);
      expect(pusherService.sendEvent).toHaveBeenCalledWith(
        `${PusherChannels.PROFILE_GENERATION}-user-1`,
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        { success: true, jobId: 'job-1', userProfileId: 'profile-1' }
      );
      expect(job.updateProgress.mock.calls.map(([value]) => value)).toEqual([
        10, 30, 80, 90, 100,
      ]);
    });

    it('tells the user the generation failed when the CV cannot be downloaded', async () => {
      mockAxiosGet.mockResolvedValue({ status: 404, data: '' });
      const { processor, openAiService, pusherService } = build();

      await expect(
        processor.handleProfileGeneration(buildJob() as never)
      ).rejects.toThrow('Erreur lors du téléchargement du PDF depuis S3: 404');

      expect(openAiService.extractCVFromImages).not.toHaveBeenCalled();
      expect(pusherService.sendEvent).toHaveBeenCalledWith(
        `${PusherChannels.PROFILE_GENERATION}-user-1`,
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        expect.objectContaining({
          success: false,
          reason: 'error',
          error: expect.stringContaining('404'),
        })
      );
    });

    it('fails when poppler cannot convert the PDF', async () => {
      mockExecFile.mockImplementation(
        (_c: string, _a: string[], callback: (e: Error) => void) =>
          callback(new Error('syntax error'))
      );
      const { processor, pusherService } = build();

      await expect(
        processor.handleProfileGeneration(buildJob() as never)
      ).rejects.toThrow('Erreur lors de la conversion PDF: syntax error');
      expect(pusherService.sendEvent).toHaveBeenCalledWith(
        expect.any(String),
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        expect.objectContaining({ success: false, reason: 'error' })
      );
    });

    it('fails when poppler produces no image', async () => {
      fakePoppler([]);
      const { processor } = build();

      await expect(
        processor.handleProfileGeneration(buildJob() as never)
      ).rejects.toThrow("Aucune image n'a été générée à partir du PDF");
    });

    it('does not save anything when OpenAI fails and reports the technical error', async () => {
      const {
        processor,
        openAiService,
        profileGenerationService,
        pusherService,
      } = build();
      openAiService.extractCVFromImages.mockRejectedValue(
        new Error('OpenAI overloaded')
      );

      await expect(
        processor.handleProfileGeneration(buildJob() as never)
      ).rejects.toThrow('OpenAI overloaded');

      expect(
        profileGenerationService.saveExtractedCVData
      ).not.toHaveBeenCalled();
      expect(pusherService.sendEvent).toHaveBeenCalledWith(
        `${PusherChannels.PROFILE_GENERATION}-user-1`,
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        {
          success: false,
          reason: 'error',
          error: 'OpenAI overloaded',
          jobId: 'job-1',
          userProfileId: 'profile-1',
        }
      );
    });

    it('uses a generic message when the failure is not an Error', async () => {
      const { processor, openAiService, pusherService } = build();
      openAiService.extractCVFromImages.mockRejectedValue('weird failure');

      await expect(
        processor.handleProfileGeneration(buildJob() as never)
      ).rejects.toBe('weird failure');

      expect(pusherService.sendEvent).toHaveBeenCalledWith(
        expect.any(String),
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        expect.objectContaining({ error: 'Une erreur est survenue' })
      );
    });

    it('discards the result of a job cancelled after the OpenAI answer', async () => {
      const {
        processor,
        profileGenerationService,
        profileGenerationQueue,
        pusherService,
      } = build();
      profileGenerationQueue.getJob.mockResolvedValue({
        data: { cancelled: true },
      });

      await expect(
        processor.handleProfileGeneration(buildJob() as never)
      ).rejects.toThrow();

      expect(
        profileGenerationService.saveExtractedCVData
      ).not.toHaveBeenCalled();
      expect(
        profileGenerationService.populateUserProfileFromCVData
      ).not.toHaveBeenCalled();
      expect(pusherService.sendEvent).toHaveBeenCalledWith(
        `${PusherChannels.PROFILE_GENERATION}-user-1`,
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        {
          success: false,
          reason: 'cancelled',
          error: undefined,
          jobId: 'job-1',
          userProfileId: 'profile-1',
        }
      );
    });

    it('aborts the OpenAI call when the job gets cancelled while waiting for it', async () => {
      const {
        processor,
        openAiService,
        profileGenerationQueue,
        profileGenerationService,
        pusherService,
      } = build();
      let wasAborted = false;
      openAiService.extractCVFromImages.mockImplementation(
        (_images: string[], signal: AbortSignal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              wasAborted = true;
              reject(new Error('Request aborted'));
            });
          })
      );
      // The cancellation request arrives while OpenAI is processing
      profileGenerationQueue.getJob.mockResolvedValue({
        data: { cancelled: true },
      });

      await expect(
        processor.handleProfileGeneration(buildJob() as never)
      ).rejects.toThrow('Request aborted');

      expect(wasAborted).toBe(true);
      expect(
        profileGenerationService.saveExtractedCVData
      ).not.toHaveBeenCalled();
      expect(pusherService.sendEvent).toHaveBeenCalledWith(
        expect.any(String),
        PusherEvents.PROFILE_GENERATION_COMPLETE,
        expect.objectContaining({ success: false, reason: 'cancelled' })
      );
    }, 15000);

    it('does not look the job up again when it has no id', async () => {
      const { processor, profileGenerationQueue } = build();
      const job = { ...buildJob(), id: undefined as string | undefined };

      await processor.handleProfileGeneration(job as never);

      expect(profileGenerationQueue.getJob).not.toHaveBeenCalled();
    });
  });
});
