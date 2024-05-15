export const PusherChannels = {
  CV_PREVIEW: 'cv-preview-channel',
  CV_PDF: 'cv-pdf-channel',
} as const;

export type PusherChannel =
  (typeof PusherChannels)[keyof typeof PusherChannels];

export const PusherEvents = {
  CV_PREVIEW_DONE: 'cv-preview-done',
  CV_PDF_DONE: 'cv-pdf-done',
} as const;

export type PusherEvent = (typeof PusherEvents)[keyof typeof PusherEvents];
