/** Result returned by admin server actions (expected failures are returned, not thrown). */
export type ActionResult<T = object> =
  | ({ ok: true; message?: string } & T)
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: string, fieldErrors?: Record<string, string>) {
  return { ok: false, error, fieldErrors } as const;
}
