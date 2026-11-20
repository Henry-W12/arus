export type RepoErrorCode =
  | 'invalid'
  | 'not-found'
  | 'duplicate-name'
  | 'has-transactions'
  | 'last-active'
  | 'limit-reached';

/** Error dari lapisan repo; `message` siap ditampilkan (bahasa Indonesia). */
export class RepoError extends Error {
  readonly code: RepoErrorCode;

  constructor(code: RepoErrorCode, message: string) {
    super(message);
    this.name = 'RepoError';
    this.code = code;
  }
}

export function isRepoError(error: unknown): error is RepoError {
  return error instanceof RepoError;
}
