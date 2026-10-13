export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = EmailDeliveryError.name;
  }
}

export function isRetryableResendError(error: {
  statusCode: number | null;
  name: string;
}): boolean {
  if (error.statusCode === null) {
    return error.name === 'application_error';
  }

  return error.statusCode === 408 || error.statusCode === 429 ||
    error.statusCode >= 500;
}
