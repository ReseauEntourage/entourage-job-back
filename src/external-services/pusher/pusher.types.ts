export const PusherChannels = {
  CV_PDF: 'cv-pdf-channel',
  PROFILE_GENERATION: 'profile-generation-channel',
  EMBEDDING: 'embedding-channel',
} as const;

export type PusherChannel =
  (typeof PusherChannels)[keyof typeof PusherChannels];

export const PusherEvents = {
  CV_PDF_DONE: 'cv-pdf-done',
  PROFILE_GENERATION_COMPLETE: 'profile-generation-complete',
  EMBEDDING_READY: 'embedding-ready',
} as const;

export type PusherEvent = (typeof PusherEvents)[keyof typeof PusherEvents];
