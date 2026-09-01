import {
  isEmail,
  mapAttendeeRows,
  parseCsv,
} from './csv.util';

describe('parseCsv', () => {
  it('parses a simple two-column CSV', () => {
    const rows = parseCsv('name,email\nJane,j@x.com\n');
    expect(rows).toHaveLength(2);
    expect(rows[0].values).toEqual(['name', 'email']);
    expect(rows[1].values).toEqual(['Jane', 'j@x.com']);
  });

  it('handles quoted fields containing commas', () => {
    const rows = parseCsv('name,email\n"Doe, Jane",j@x.com\n');
    expect(rows[1].values).toEqual(['Doe, Jane', 'j@x.com']);
  });

  it('handles escaped double quotes inside a quoted field', () => {
    const rows = parseCsv('name,email\n"Jane ""JJ"" Doe",j@x.com\n');
    expect(rows[1].values).toEqual(['Jane "JJ" Doe', 'j@x.com']);
  });

  it('preserves newlines inside quoted fields', () => {
    const rows = parseCsv('name,email\n"Jane\nDoe",j@x.com\n');
    expect(rows[1].values).toEqual(['Jane\nDoe', 'j@x.com']);
  });

  it('strips a leading BOM', () => {
    const rows = parseCsv('\ufeffname,email\nJane,j@x.com\n');
    expect(rows[0].values[0]).toBe('name');
  });

  it('parses a file without a trailing newline', () => {
    const rows = parseCsv('name,email\nJane,j@x.com');
    expect(rows).toHaveLength(2);
  });
});

describe('isEmail', () => {
  it('accepts a normal email', () => {
    expect(isEmail('jane.doe@example.com')).toBe(true);
  });
  it('rejects malformed emails', () => {
    expect(isEmail('not-an-email')).toBe(false);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('')).toBe(false);
  });
});

describe('mapAttendeeRows', () => {
  it('maps header names and optional pass type', () => {
    const parsed = parseCsv('Full Name,Email Address,Pass Type\nJane Doe,j@x.com,VIP\n');
    const res = mapAttendeeRows(parsed);
    expect(res.errors).toEqual([]);
    expect(res.rows).toEqual([
      { name: 'Jane Doe', email: 'j@x.com', passType: 'VIP' },
    ]);
  });

  it('supports files without headers (name,email,passType order)', () => {
    const parsed = parseCsv('Jane Doe,j@x.com,General\n');
    const res = mapAttendeeRows(parsed);
    expect(res.headerRowNumber).toBe(0);
    expect(res.rows).toEqual([
      { name: 'Jane Doe', email: 'j@x.com', passType: 'General' },
    ]);
  });

  it('reports per-row errors and skips the bad rows', () => {
    const parsed = parseCsv(
      'name,email\nGood,g@x.com\n,nope@\nmissingemail\nBad Name,bad-email\n',
    );
    const res = mapAttendeeRows(parsed);
    expect(res.rows).toEqual([{ name: 'Good', email: 'g@x.com', passType: undefined }]);
    expect(res.errors.length).toBe(3);
    expect(res.errors[0].message).toContain('missing a name');
    expect(res.errors[1].message).toContain('missing an email');
    expect(res.errors[2].message).toContain('not a valid email');
  });

  it('ignores completely blank rows without an error', () => {
    const parsed = parseCsv('name,email\nGood,g@x.com\n\n\n');
    const res = mapAttendeeRows(parsed);
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(1);
  });

  it('returns empty when there is no data', () => {
    const res = mapAttendeeRows([]);
    expect(res.rows).toEqual([]);
    expect(res.errors).toEqual([]);
  });
});