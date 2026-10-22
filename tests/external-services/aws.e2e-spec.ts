import { CloudFrontService } from 'src/external-services/aws/cloud-front.service';
import {
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  S3Service,
} from 'src/external-services/aws/s3.service';

const mockS3Send = jest.fn();
const mockUploadDone = jest.fn();
const mockUploadConstructor = jest.fn();
const mockGetSignedUrl = jest.fn();
const mockCloudFrontSend = jest.fn();

// No call to AWS is ever made: the SDK clients and commands are replaced by doubles.
jest.mock('@aws-sdk/client-s3', () => {
  const command = (name: string) =>
    class {
      readonly name = name;
      constructor(public readonly input: Record<string, unknown>) {}
    };
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
    DeleteObjectsCommand: command('DeleteObjects'),
    GetObjectCommand: command('GetObject'),
    HeadObjectCommand: command('HeadObject'),
  };
});
jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation((options: unknown) => {
    mockUploadConstructor(options);
    return { done: mockUploadDone };
  }),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));
jest.mock('@aws-sdk/client-cloudfront', () => ({
  CloudFrontClient: jest
    .fn()
    .mockImplementation(() => ({ send: mockCloudFrontSend })),
  CreateInvalidationCommand: class {
    constructor(public readonly input: Record<string, unknown>) {}
  },
}));

const ENV_KEYS = [
  'AWSS3_BUCKET_NAME',
  'AWSS3_IMAGE_DIRECTORY',
  'AWSS3_FILE_DIRECTORY',
  'CDN_ID',
];

describe('AWS services', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    ENV_KEYS.forEach((key) => {
      savedEnv[key] = process.env[key];
    });
    process.env.AWSS3_BUCKET_NAME = 'test-bucket';
    process.env.AWSS3_IMAGE_DIRECTORY = 'images/';
    process.env.AWSS3_FILE_DIRECTORY = 'files/';
    process.env.CDN_ID = 'CDN123';
  });

  afterAll(() => {
    ENV_KEYS.forEach((key) => {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    });
  });

  beforeEach(() => {
    mockS3Send.mockReset();
    mockUploadDone.mockReset().mockResolvedValue({});
    mockUploadConstructor.mockReset();
    mockGetSignedUrl.mockReset();
    mockCloudFrontSend.mockReset();
  });

  describe('S3Service', () => {
    describe('upload', () => {
      it('stores an image in the image directory with a public read access and returns its public url', async () => {
        const service = new S3Service();

        const result = await service.upload(
          Buffer.from('data'),
          'image/png',
          'avatar.png'
        );

        expect(mockUploadConstructor).toHaveBeenCalledWith(
          expect.objectContaining({
            params: {
              Bucket: 'test-bucket',
              Key: 'images/avatar.png',
              Body: Buffer.from('data'),
              ACL: 'public-read',
              ContentType: 'image/png',
            },
          })
        );
        expect(result).toEqual({
          key: 'images/avatar.png',
          publicUrl:
            'https://test-bucket.s3.eu-west-3.amazonaws.com/images/avatar.png',
        });
      });

      it('stores any other content in the file directory', async () => {
        const service = new S3Service();

        const result = await service.upload(
          Buffer.from('pdf'),
          'application/pdf',
          'cv.pdf'
        );

        expect(result.key).toBe('files/cv.pdf');
      });

      it('keeps a private file private and returns no public url', async () => {
        const service = new S3Service();

        const result = await service.upload(
          Buffer.from('pdf'),
          'application/pdf',
          'secret.pdf',
          true
        );

        expect(mockUploadConstructor).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({ ACL: 'private' }),
          })
        );
        expect(result).toEqual({ key: 'files/secret.pdf', publicUrl: null });
      });

      it('propagates the upload errors', async () => {
        mockUploadDone.mockRejectedValue(new Error('S3 down'));
        const service = new S3Service();

        await expect(
          service.upload(Buffer.from('x'), 'image/png', 'a.png')
        ).rejects.toThrow('S3 down');
      });
    });

    describe('copyFile', () => {
      it('downloads the source and uploads it again as a public image', async () => {
        mockS3Send.mockResolvedValue({ Body: 'binary' });
        const service = new S3Service();

        const result = await service.copyFile('images/source.jpg', 'copy.jpg');

        expect(mockS3Send).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'GetObject',
            input: { Bucket: 'test-bucket', Key: 'images/source.jpg' },
          })
        );
        expect(mockUploadConstructor).toHaveBeenCalledWith(
          expect.objectContaining({
            params: expect.objectContaining({
              Key: 'images/copy.jpg',
              Body: 'binary',
              ContentType: 'image/jpeg',
            }),
          })
        );
        expect(result.key).toBe('images/copy.jpg');
      });
    });

    describe('deleteFiles', () => {
      it('deletes a single key', async () => {
        const service = new S3Service();

        const deleted = await service.deleteFiles('images/a.png');

        expect(deleted).toEqual(['images/a.png']);
        expect(mockS3Send).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'DeleteObjects',
            input: {
              Bucket: 'test-bucket',
              Delete: { Objects: [{ Key: 'images/a.png' }] },
            },
          })
        );
      });

      it('deletes several keys in one call', async () => {
        const service = new S3Service();

        await service.deleteFiles(['a', 'b']);

        expect(mockS3Send).toHaveBeenCalledTimes(1);
        expect(mockS3Send.mock.calls[0][0].input.Delete.Objects).toEqual([
          { Key: 'a' },
          { Key: 'b' },
        ]);
      });
    });

    it('reads the head of an object', async () => {
      mockS3Send.mockResolvedValue({ ContentLength: 12 });
      const service = new S3Service();

      const head = await service.getHead('files/cv.pdf');

      expect(head).toEqual({ ContentLength: 12 });
      expect(mockS3Send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'HeadObject',
          input: { Bucket: 'test-bucket', Key: 'files/cv.pdf' },
        })
      );
    });

    describe('getSignedUrl', () => {
      it('signs a download link valid for one minute by default', async () => {
        mockGetSignedUrl.mockResolvedValue('https://signed.example.org');
        const service = new S3Service();

        const url = await service.getSignedUrl(
          'files/cv.pdf',
          'application/pdf'
        );

        expect(url).toBe('https://signed.example.org');
        const [, command, options] = mockGetSignedUrl.mock.calls[0];
        expect(command.input).toEqual({
          Bucket: 'test-bucket',
          Key: 'files/cv.pdf',
          ResponseContentDisposition: 'attachment',
          ResponseContentType: 'application/pdf',
        });
        expect(options).toEqual({ expiresIn: DEFAULT_SIGNED_URL_TTL_SECONDS });
      });

      it('accepts a custom disposition and validity', async () => {
        mockGetSignedUrl.mockResolvedValue('url');
        const service = new S3Service();

        await service.getSignedUrl('k', 'image/png', 'inline', 600);

        const [, command, options] = mockGetSignedUrl.mock.calls[0];
        expect(command.input.ResponseContentDisposition).toBe('inline');
        expect(options).toEqual({ expiresIn: 600 });
      });
    });
  });

  describe('CloudFrontService', () => {
    it('invalidates the given paths, url-encoded, on the distribution', async () => {
      mockCloudFrontSend.mockResolvedValue({ Invalidation: { Id: 'INV1' } });
      const service = new CloudFrontService();

      const result = await service.invalidateCache([
        '/images/a b.png',
        '/images/c.png',
      ]);

      expect(result).toEqual({ Id: 'INV1' });
      const [command] = mockCloudFrontSend.mock.calls[0];
      expect(command.input.DistributionId).toBe('CDN123');
      expect(command.input.InvalidationBatch.Paths).toEqual({
        Quantity: 2,
        Items: ['/images/a%20b.png', '/images/c.png'],
      });
      expect(command.input.InvalidationBatch.CallerReference).toEqual(
        expect.any(String)
      );
    });

    it('propagates the CloudFront errors', async () => {
      mockCloudFrontSend.mockRejectedValue(new Error('denied'));
      const service = new CloudFrontService();

      await expect(service.invalidateCache(['/a'])).rejects.toThrow('denied');
    });
  });
});
