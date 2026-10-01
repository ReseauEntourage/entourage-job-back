/**
 * Where a failed relay call comes from:
 * - `mailjet`: the relay forwarded an error answered by Mailjet itself;
 * - `relay`: the relay answered itself (bad secret, validation, timeout...);
 * - `network`: no answer was obtained from the relay (unreachable, reset, timeout).
 */
export type MailjetRelaySource = 'mailjet' | 'relay' | 'network';

/**
 * Longer than the relay's own 20 s limit, so that the relay's answer (504
 * included) is normally received instead of being cut before it.
 */
export const MAILJET_RELAY_TIMEOUT_MS = 25000;

const RELAY_SOURCE_HEADER = 'x-relay-source';
const RELAY_SECRET_HEADER = 'x-relay-secret';

/** Same shape as what `node-mailjet` resolves, so callers are unaffected. */
export interface MailjetRelayResult {
  body: unknown;
  response: { status: number };
}

interface MailjetRelayErrorDetails {
  code?: string;
  data?: unknown;
  source: MailjetRelaySource;
  statusCode?: number;
}

/**
 * Error thrown for every failed relay call. It exposes the same fields as the
 * errors thrown by `node-mailjet` (`statusCode`, `response.data`, `ErrorCode`,
 * `ErrorIdentifier`, `ErrorMessage`, `ErrorRelatedTo`), so that the existing
 * error logging keeps its level of detail.
 */
export class MailjetRelayError extends Error {
  code?: string;
  ErrorCode?: string;
  ErrorIdentifier?: string;
  ErrorMessage?: string;
  ErrorRelatedTo?: string[];
  response?: { data: unknown };
  source: MailjetRelaySource;
  statusCode?: number;

  constructor(message: string, details: MailjetRelayErrorDetails) {
    super(message);
    this.name = 'MailjetRelayError';
    this.source = details.source;
    this.statusCode = details.statusCode;
    this.code = details.code;
    if (details.data !== undefined) {
      this.response = { data: details.data };
    }
    if (typeof details.data === 'object' && details.data !== null) {
      const body = details.data as Record<string, unknown>;
      if (typeof body.ErrorCode === 'string') this.ErrorCode = body.ErrorCode;
      if (typeof body.ErrorIdentifier === 'string') {
        this.ErrorIdentifier = body.ErrorIdentifier;
      }
      if (typeof body.ErrorMessage === 'string') {
        this.ErrorMessage = body.ErrorMessage;
      }
      if (Array.isArray(body.ErrorRelatedTo)) {
        this.ErrorRelatedTo = body.ErrorRelatedTo as string[];
      }
    }
  }
}

/**
 * Sends Mailjet requests, already built by the back-end, to the Mailjet relay
 * lambda (see the `add-mailjet-relay-lambda` change of entourage-tasks).
 * It makes a single attempt per call: retries are the work queue's job.
 */
export class MailjetRelayClient {
  private readonly baseUrl: string;

  constructor(
    url: string,
    private readonly secret: string
  ) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  /** Relays a transactional send (`{ Messages: [...] }` body). */
  send(body: unknown): Promise<MailjetRelayResult> {
    return this.post('/send', body);
  }

  /** Relays the addition or update of one contact in a newsletter list. */
  manageContact(listId: number, body: unknown): Promise<MailjetRelayResult> {
    return this.post('/contacts', { listId, body });
  }

  private async post(
    path: string,
    payload: unknown
  ): Promise<MailjetRelayResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [RELAY_SECRET_HEADER]: this.secret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(MAILJET_RELAY_TIMEOUT_MS),
      });
    } catch (error) {
      const cause = (error as { cause?: { code?: string } })?.cause;
      throw new MailjetRelayError(
        `Mailjet relay unreachable (${
          error instanceof Error ? `${error.name}: ${error.message}` : 'unknown'
        })`,
        {
          source: 'network',
          code: (error as { code?: string })?.code ?? cause?.code,
        }
      );
    }

    const text = await response.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Keep the raw text when the body is not JSON.
    }

    if (!response.ok) {
      // When the header is missing, assume the relay answered itself.
      const source: MailjetRelaySource =
        response.headers.get(RELAY_SOURCE_HEADER) === 'mailjet'
          ? 'mailjet'
          : 'relay';
      const who =
        source === 'mailjet'
          ? 'Mailjet rejected the request'
          : 'Mailjet relay rejected the request';
      throw new MailjetRelayError(`${who} (status ${response.status})`, {
        source,
        statusCode: response.status,
        data,
      });
    }

    return { response: { status: response.status }, body: data };
  }
}
