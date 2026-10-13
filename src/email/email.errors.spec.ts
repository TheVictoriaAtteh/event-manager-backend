import { isRetryableResendError } from './email.errors';

describe('isRetryableResendError', () => {
  it('does not retry permanent client errors such as 403', () => {
    expect(
      isRetryableResendError({ statusCode: 403, name: 'validation_error' }),
    ).toBe(false);
    expect(
      isRetryableResendError({ statusCode: 400, name: 'validation_error' }),
    ).toBe(false);
  });

  it('retries transient provider errors and rate limits', () => {
    expect(
      isRetryableResendError({ statusCode: 408, name: 'application_error' }),
    ).toBe(true);
    expect(
      isRetryableResendError({ statusCode: 429, name: 'application_error' }),
    ).toBe(true);
    expect(
      isRetryableResendError({ statusCode: 503, name: 'application_error' }),
    ).toBe(true);
  });

  it('treats a status-less provider error as permanent', () => {
    expect(
      isRetryableResendError({
        statusCode: null,
        name: 'validation_error',
      }),
    ).toBe(false);
  });

  it('retries Resend network errors with no HTTP status', () => {
    expect(
      isRetryableResendError({
        statusCode: null,
        name: 'application_error',
      }),
    ).toBe(true);
  });
});
