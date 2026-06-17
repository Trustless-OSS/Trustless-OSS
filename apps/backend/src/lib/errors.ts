export class WebhookError extends Error {
  readonly code = 'WEBHOOK_ERROR';
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'WebhookError';
  }
}

export class StellarError extends Error {
  readonly code = 'STELLAR_ERROR';
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StellarError';
  }
}

export class GitHubError extends Error {
  readonly code = 'GITHUB_ERROR';
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export class DatabaseError extends Error {
  readonly code = 'DATABASE_ERROR';
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}
