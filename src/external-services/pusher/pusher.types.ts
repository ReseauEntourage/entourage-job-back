export const PusherChannels = {
  CV_PDF: 'cv-pdf-channel',
} as const;

export type PusherChannel =
  (typeof PusherChannels)[keyof typeof PusherChannels];

export const PusherEvents = {
  CV_PDF_DONE: 'cv-pdf-done',
} as const;

export type PusherEvent = (typeof PusherEvents)[keyof typeof PusherEvents];
