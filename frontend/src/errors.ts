/** Thrown by the api client when a read hits a password-locked wall (HTTP 401
 *  with `locked: true`). Callers (useEventData) show the unlock prompt instead
 *  of a generic error. Kept in its own module so api.ts and demo.ts can both
 *  import it without a cycle. */
export class LockedError extends Error {
  constructor() {
    super("This wall is locked");
    this.name = "LockedError";
  }
}
