export class PreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreflightError';
  }
}
