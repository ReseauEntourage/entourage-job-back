import {
  MediasService,
  MEDIA_SIGNED_URL_TTL_SECONDS,
} from 'src/medias/medias.service';
import { Media } from 'src/medias/models';

// Pure unit test (no database): MediasService only needs a stubbed S3Service.
describe('MediasService.attachSignedUrls', () => {
  it('should sign medias for one hour', async () => {
    const getSignedUrl = jest.fn(async () => 'signed-url');
    const service = new MediasService({} as never, { getSignedUrl } as never);
    const media = {
      s3Key: 'key.pdf',
      mimeType: 'application/pdf',
    } as Media;

    await service.attachSignedUrls([media]);

    expect(MEDIA_SIGNED_URL_TTL_SECONDS).toBe(3600);
    expect(getSignedUrl).toHaveBeenCalledWith(
      'key.pdf',
      'application/pdf',
      'inline',
      3600
    );
    expect(media.signedUrl).toBe('signed-url');
  });
});
