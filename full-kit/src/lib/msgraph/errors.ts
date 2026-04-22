/**
 * Error thrown for any non-2xx response from Microsoft Graph or the token endpoint.
 * Carries Graph's structured error code (e.g. "Authorization_RequestDenied"),
 * the HTTP status, and the path that was called — enough for downstream code
 * to make decisions like `if (err.status === 403) ...`.
 */
export class GraphError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    public readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "GraphError";
  }
}
