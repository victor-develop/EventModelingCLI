import { lintCanonicalId } from '../src/validation/lint';

describe('lint rules', () => {
  test('LINT-001: invalid characters', () => {
    const errors = lintCanonicalId('Order.CMD', 'cmd', new Set());
    expect(errors.some(e => e.code === 'LINT-001')).toBe(true);
  });

  test('LINT-002: duplicate canonicalId', () => {
    const errors = lintCanonicalId('order.cmd.test-do', 'cmd', new Set(['order.cmd.test-do']));
    expect(errors.some(e => e.code === 'LINT-002')).toBe(true);
  });

  test('LINT-003: reserved word segment', () => {
    const errors = lintCanonicalId('order.new.test', 'cmd', new Set());
    expect(errors.some(e => e.code === 'LINT-003')).toBe(true);
  });

  test('LINT-CMD-001: valid cmd pattern', () => {
    const errors = lintCanonicalId('order.payment.cmd.capture-charge', 'cmd', new Set());
    expect(errors.some(e => e.code === 'LINT-CMD-001')).toBe(false);
  });

  test('LINT-CMD-001: invalid cmd pattern', () => {
    const errors = lintCanonicalId('order.cmd', 'cmd', new Set());
    expect(errors.some(e => e.code === 'LINT-CMD-001')).toBe(true);
  });

  test('LINT-EVT-001: valid evt pattern', () => {
    const errors = lintCanonicalId('order.payment.evt.charge.succeeded', 'evt', new Set());
    expect(errors.some(e => e.code === 'LINT-EVT-001')).toBe(false);
  });

  test('LINT-VIEW-001: valid view pattern', () => {
    const errors = lintCanonicalId('order.payment.view.charge.detail', 'viewModel', new Set());
    expect(errors.some(e => e.code === 'LINT-VIEW-001')).toBe(false);
  });

  test('LINT-PROC-001: valid proc pattern', () => {
    const errors = lintCanonicalId('order.payment.proc.charge.reconcile', 'proc', new Set());
    expect(errors.some(e => e.code === 'LINT-PROC-001')).toBe(false);
  });

  test('LINT-TRIGGER-001: valid trigger pattern', () => {
    const errors = lintCanonicalId('order.payment.trigger.webhook.stripe-event', 'trigger', new Set());
    expect(errors.some(e => e.code === 'LINT-TRIGGER-001')).toBe(false);
  });

  test('LINT-EVT-002: vague state warning', () => {
    const errors = lintCanonicalId('order.evt.order.updated', 'evt', new Set());
    expect(errors.some(e => e.code === 'LINT-EVT-002')).toBe(true);
    expect(errors.find(e => e.code === 'LINT-EVT-002')!.severity).toBe('warning');
  });
});
