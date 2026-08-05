import { isSensitiveDiffPath, redactDiffValue } from '../src/viewer-contract/redaction';

describe('viewer contract redaction', () => {
  test.each([
    'meta.apiKey',
    'meta.accessKey',
    'meta.client_key',
    'meta.service-key',
    'meta.openai-key',
    'headers.x-api-key',
    'credentials.privateKey',
    'auth.token',
  ])('treats %s as sensitive', (path) => {
    expect(isSensitiveDiffPath(path)).toBe(true);
  });

  test('redacts common secret-like keys without redacting unrelated words', () => {
    const redacted = redactDiffValue({
      meta: {
        accessKey: 'access-secret',
        client_key: 'client-secret',
        'service-key': 'service-secret',
        monkey: 'banana',
      },
    });

    expect(redacted).toEqual({
      meta: {
        accessKey: '[REDACTED]',
        client_key: '[REDACTED]',
        'service-key': '[REDACTED]',
        monkey: 'banana',
      },
    });
  });
});
