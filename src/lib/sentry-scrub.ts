/**
 * Removes personal data from Sentry events before they leave the app (the `beforeSend` hook, used
 * by the server and browser SDK). Pure, no Sentry import, so it is unit tested.
 *
 * What can leak: URLs (`/order/confirmation?number=…&token=…`, `/suivi`, `/search?q=`), request
 * bodies / headers / cookies (phone, address, email), the user, breadcrumbs, and error messages
 * that quote a value. The SDK is also configured with `sendDefaultPii: false`.
 */

const REDACTED = "[redacted]";
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;
const PHONE = /(?:\+|00)?216[\s.-]?\d(?:[\s.-]?\d){7}\b|\b\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g;
// Tracking tokens are 256 bits in base64url (43 characters); redact any long url-safe blob.
const LONG_TOKEN = /[A-Za-z0-9_-]{32,}/g;

export function redactText(text: string): string {
  return text.replace(EMAIL, REDACTED).replace(PHONE, REDACTED).replace(LONG_TOKEN, REDACTED);
}

/** Keeps origin and path, drops the query string and the fragment. */
export function scrubUrl(value: string): string {
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

type Loose = {
  request?: Record<string, unknown>;
  user?: unknown;
  breadcrumbs?: unknown;
  extra?: unknown;
  contexts?: Record<string, unknown>;
  message?: string;
  exception?: { values?: Array<Record<string, unknown>> };
  transaction?: string;
  tags?: Record<string, unknown>;
};

export function scrubEvent<T extends object>(input: T): T {
  const event = input as Loose;

  if (event.request) {
    const request = event.request;
    if (typeof request.url === "string") request.url = scrubUrl(request.url);
    delete request.data;
    delete request.cookies;
    delete request.headers;
    delete request.query_string;
    delete request.env;
  }
  delete event.user;
  delete event.breadcrumbs;
  delete event.extra;
  if (event.contexts) {
    delete event.contexts.request;
    delete event.contexts.trace_data;
  }
  if (typeof event.transaction === "string") event.transaction = scrubUrl(event.transaction);
  if (event.tags) {
    for (const [key, value] of Object.entries(event.tags)) {
      if (typeof value === "string" && /url|referrer/i.test(key)) event.tags[key] = scrubUrl(value);
    }
  }
  if (typeof event.message === "string") event.message = redactText(event.message);
  for (const exception of event.exception?.values ?? []) {
    if (typeof exception.value === "string") exception.value = redactText(exception.value);
  }
  return input;
}

/**
 * Shared Sentry init options. @sentry/nextjs 11 replaced `sendDefaultPii` by `dataCollection`;
 * everything that can carry personal data is switched off (the scrubber is a second layer).
 */
export const SENTRY_COMMON_OPTIONS = {
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
    genAI: { inputs: false, outputs: false },
    graphQL: { document: false, variables: false },
  },
  tracesSampleRate: 0,
  maxBreadcrumbs: 0,
  beforeBreadcrumb: () => null,
  beforeSend: <T extends object>(event: T) => scrubEvent(event),
};
