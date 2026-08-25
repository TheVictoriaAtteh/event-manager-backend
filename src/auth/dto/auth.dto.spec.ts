import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { ResetPasswordDto } from './reset-password.dto';
import { VerifyEmailDto } from './verify-email.dto';

const OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

async function errorsOf<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, plain);
  const errors = await validate(dto, OPTIONS);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('RegisterDto validation', () => {
  const VALID = {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    password: 'S3cure!password',
  };

  it('accepts a valid payload', async () => {
    expect(await errorsOf(RegisterDto, VALID)).toEqual([]);
  });

  it('accepts an optional role of ADMIN or ATTENDEE', async () => {
    expect(await errorsOf(RegisterDto, { ...VALID, role: 'ADMIN' })).toEqual([]);
    expect(await errorsOf(RegisterDto, { ...VALID, role: 'ATTENDEE' })).toEqual([]);
    expect(await errorsOf(RegisterDto, { ...VALID, role: 'SUPERUSER' })).not.toEqual(
      [],
    );
  });

  it('rejects an invalid email', async () => {
    expect(await errorsOf(RegisterDto, { ...VALID, email: 'not-an-email' })).not.toEqual([]);
  });

  it('rejects a password shorter than 8 characters', async () => {
    expect(await errorsOf(RegisterDto, { ...VALID, password: 'short' })).not.toEqual([]);
  });

  it('rejects missing required fields', async () => {
    expect(await errorsOf(RegisterDto, {})).not.toEqual([]);
    expect(await errorsOf(RegisterDto, { email: VALID.email })).not.toEqual([]);
    expect(await errorsOf(RegisterDto, { name: VALID.name, email: VALID.email })).not.toEqual([]);
  });

  it('rejects unknown properties (forbidNonWhitelisted)', async () => {
    expect(
      await errorsOf(RegisterDto, { ...VALID, isAdmin: true }),
    ).not.toEqual([]);
  });
});

describe('LoginDto validation', () => {
  it('accepts a valid payload', async () => {
    expect(
      await errorsOf(LoginDto, { email: 'a@b.com', password: 'anything1' }),
    ).toEqual([]);
  });

  it('rejects an invalid email', async () => {
    expect(
      await errorsOf(LoginDto, { email: 'nope', password: 'anything1' }),
    ).not.toEqual([]);
  });

  it('rejects a missing password', async () => {
    expect(await errorsOf(LoginDto, { email: 'a@b.com' })).not.toEqual([]);
  });
});

describe('VerifyEmailDto validation', () => {
  it('accepts tokenHash, legacy token or PKCE code', async () => {
    expect(await errorsOf(VerifyEmailDto, { tokenHash: 'h' })).toEqual([]);
    expect(await errorsOf(VerifyEmailDto, { token: 't' })).toEqual([]);
    expect(await errorsOf(VerifyEmailDto, { code: 'c' })).toEqual([]);
  });
});

describe('ResetPasswordDto validation', () => {
  it('requires a new password', async () => {
    expect(await errorsOf(ResetPasswordDto, {})).not.toEqual([]);
    expect(
      await errorsOf(ResetPasswordDto, { tokenHash: 'h' }),
    ).not.toEqual([]);
  });

  it('accepts a valid payload', async () => {
    expect(
      await errorsOf(ResetPasswordDto, { tokenHash: 'h', newPassword: 'N3w!password' }),
    ).toEqual([]);
  });

  it('rejects a short new password', async () => {
    expect(
      await errorsOf(ResetPasswordDto, { tokenHash: 'h', newPassword: 'short' }),
    ).not.toEqual([]);
  });
});
