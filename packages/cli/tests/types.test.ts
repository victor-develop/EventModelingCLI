import { okResult, errResult } from '../src/domain/types';

describe('CLIResult helpers', () => {
  test('okResult creates success response', () => {
    const r = okResult('em test', { foo: 'bar' });
    expect(r.ok).toBe(true);
    expect(r.command).toBe('em test');
    expect(r.data).toEqual({ foo: 'bar' });
    expect(r.warnings).toEqual([]);
    expect(r.error).toBeUndefined();
  });

  test('okResult with optional fields', () => {
    const r = okResult('em test', {}, { projectId: 'p1', draftId: 'd1', revisionId: 'r1' });
    expect(r.projectId).toBe('p1');
    expect(r.draftId).toBe('d1');
    expect(r.revisionId).toBe('r1');
  });

  test('errResult creates failure response', () => {
    const r = errResult('em test', 'ERR_001', 'Something went wrong');
    expect(r.ok).toBe(false);
    expect(r.command).toBe('em test');
    expect(r.error?.code).toBe('ERR_001');
    expect(r.error?.message).toBe('Something went wrong');
  });
});
