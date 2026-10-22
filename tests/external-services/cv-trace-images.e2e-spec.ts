import {
  DEFAULT_CV_TRACE_IMAGES_MAX_BYTES,
  getCvTraceImagesConfig,
  selectCvTraceImages,
  totalImagesBytes,
} from 'src/external-services/llm-observability/cv-trace-images';

// Pure unit tests (no database, no network)
const page = (size: number) => 'a'.repeat(size);

describe('getCvTraceImagesConfig', () => {
  const saved = {
    enabled: process.env.LLM_OBS_CV_IMAGES_ENABLED,
    maxBytes: process.env.LLM_OBS_CV_IMAGES_MAX_BYTES,
  };

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    restore('LLM_OBS_CV_IMAGES_ENABLED', saved.enabled);
    restore('LLM_OBS_CV_IMAGES_MAX_BYTES', saved.maxBytes);
  });

  it('is disabled with a 3 MB budget by default', () => {
    delete process.env.LLM_OBS_CV_IMAGES_ENABLED;
    delete process.env.LLM_OBS_CV_IMAGES_MAX_BYTES;

    expect(getCvTraceImagesConfig()).toEqual({
      enabled: false,
      maxBytes: 3_000_000,
    });
  });

  it('is enabled only by the value true', () => {
    process.env.LLM_OBS_CV_IMAGES_ENABLED = 'true';
    expect(getCvTraceImagesConfig().enabled).toBe(true);

    process.env.LLM_OBS_CV_IMAGES_ENABLED = '1';
    expect(getCvTraceImagesConfig().enabled).toBe(false);
  });

  it('reads the budget, and falls back on the default when it is not a positive number', () => {
    process.env.LLM_OBS_CV_IMAGES_MAX_BYTES = '1000';
    expect(getCvTraceImagesConfig().maxBytes).toBe(1000);

    for (const invalid of ['abc', '0', '-5', '']) {
      process.env.LLM_OBS_CV_IMAGES_MAX_BYTES = invalid;
      expect(getCvTraceImagesConfig().maxBytes).toBe(
        DEFAULT_CV_TRACE_IMAGES_MAX_BYTES
      );
    }
  });
});

describe('selectCvTraceImages', () => {
  const config = { enabled: true, maxBytes: 100 };

  it('attaches every page when they fit in the budget', () => {
    const pages = [page(40), page(40)];

    expect(selectCvTraceImages(pages, config)).toEqual({
      attached: pages,
      omitted: 0,
      marker: null,
    });
  });

  it('attaches pages up to the budget limit included', () => {
    const pages = [page(50), page(50)];

    expect(selectCvTraceImages(pages, config).attached).toEqual(pages);
  });

  it('keeps the leading pages that fit and counts the others as omitted', () => {
    const pages = [page(60), page(30), page(30)];

    expect(selectCvTraceImages(pages, config)).toEqual({
      attached: [pages[0], pages[1]],
      omitted: 1,
      marker: '[1 page non jointe : plafond de taille]',
    });
  });

  it('stops at the first page that does not fit, even if a later one would', () => {
    const pages = [page(60), page(80), page(10)];

    const result = selectCvTraceImages(pages, config);

    expect(result.attached).toEqual([pages[0]]);
    expect(result.omitted).toBe(2);
    expect(result.marker).toBe('[2 pages non jointes : plafond de taille]');
  });

  it('attaches nothing when the first page is above the budget', () => {
    const result = selectCvTraceImages([page(500)], config);

    expect(result.attached).toEqual([]);
    expect(result.omitted).toBe(1);
  });

  it('attaches nothing, and says so, when sending the images is disabled', () => {
    const result = selectCvTraceImages([page(10), page(10)], {
      enabled: false,
      maxBytes: 100,
    });

    expect(result).toEqual({
      attached: [],
      omitted: 2,
      marker: '[2 pages non jointes : envoi des images désactivé]',
    });
  });

  it('has nothing to say about a CV without page', () => {
    expect(selectCvTraceImages([], config).marker).toBeNull();
    expect(
      selectCvTraceImages([], { enabled: false, maxBytes: 100 }).marker
    ).toBeNull();
  });
});

describe('totalImagesBytes', () => {
  it('sums the weight of the pages', () => {
    expect(totalImagesBytes([page(10), page(5)])).toBe(15);
    expect(totalImagesBytes([])).toBe(0);
  });
});
