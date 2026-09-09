import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { executeRoutedCommand, EventGuardTerminal } from '../src/cli/index';
import { routeCommand } from '../src/cli/router';
import type { DraftImpactAnalysis } from '../src/drafts/impact';
import { assessEventFieldEvolution } from '../src/schema/event-evolution-policy';
import { Workspace } from '../src/workspace/workspace';

const eventId = 'order.evt.order-placed';
const fieldId = 'status';

describe('Event evolution policy', () => {
  const before = { fieldId, name: 'status', type: 'string', required: false };

  test('guards only breaking effective changes and consolidates their codes', () => {
    expect(assessEventFieldEvolution(eventId, before, {
      ...before,
      name: 'orderStatus',
      type: 'OrderStatus',
      required: true,
    }).map(warning => warning.code)).toEqual([
      'EVENT_FIELD_TYPE_CHANGED',
      'EVENT_FIELD_REQUIREDNESS_CHANGED',
      'EVENT_FIELD_RENAMED',
    ]);
    expect(assessEventFieldEvolution(eventId, before, null).map(warning => warning.code))
      .toEqual(['EVENT_FIELD_REMOVED']);
  });

  test('does not guard descriptions, required-to-optional, or unchanged fields', () => {
    expect(assessEventFieldEvolution(eventId, { ...before, required: true }, before)).toEqual([]);
    expect(assessEventFieldEvolution(eventId, before, { ...before, description: 'New text' })).toEqual([]);
    expect(assessEventFieldEvolution(eventId, before, { ...before })).toEqual([]);
  });
});

describe('Event schema evolution command guard', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  function fixture(required = false): Workspace {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'em-event-guard-'));
    tempDirs.push(dir);
    const ws = new Workspace(dir);
    expect(routeCommand(ws, ['project', 'init', 'Event Guard']).ok).toBe(true);
    expect(routeCommand(ws, ['draft', 'start', '--n', 'baseline']).ok).toBe(true);
    expect(routeCommand(ws, ['evt', 'new', eventId]).ok).toBe(true);
    expect(routeCommand(ws, [
      'evt', 'field', 'add', eventId,
      '--field-id', fieldId,
      '--name', 'status',
      '--type', 'string',
      required ? '--required' : '--optional',
    ]).ok).toBe(true);
    expect(routeCommand(ws, ['submit', '--m', 'baseline event contract']).ok).toBe(true);
    expect(routeCommand(ws, ['draft', 'start', '--n', 'evolve contract']).ok).toBe(true);
    return ws;
  }

  function persistedState(ws: Workspace): string {
    return JSON.stringify({
      schema: ws.getEventSchema(eventId),
      draft: ws.getContext()?.draft,
      manifest: ws.getManifest(),
    });
  }

  test.each([
    ['type change', ['evt', 'field', 'edit', eventId, fieldId, '--type', 'OrderStatus'], ['EVENT_FIELD_TYPE_CHANGED']],
    ['optional-to-required', ['evt', 'field', 'edit', eventId, fieldId, '--required'], ['EVENT_FIELD_REQUIREDNESS_CHANGED']],
    ['rename', ['evt', 'field', 'edit', eventId, fieldId, '--name', 'orderStatus'], ['EVENT_FIELD_RENAMED']],
    ['removal', ['evt', 'field', 'rm', eventId, fieldId], ['EVENT_FIELD_REMOVED']],
  ])('%s requires confirmation and performs zero writes', (_label, args, codes) => {
    const ws = fixture(false);
    const before = persistedState(ws);

    const result = routeCommand(ws, args as string[]);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('EVENT_SCHEMA_EVOLUTION_CONFIRMATION_REQUIRED');
    expect(result.error?.details).toMatchObject({ eventId, fieldId, warningCodes: codes });
    expect(persistedState(ws)).toBe(before);
  });

  test('one edit with multiple breaking changes returns one consolidated guard result', () => {
    const ws = fixture(false);
    const result = routeCommand(ws, [
      'evt', 'field', 'edit', eventId, fieldId,
      '--name', 'orderStatus',
      '--type', 'OrderStatus',
      '--required',
    ]);

    expect(result.error?.details?.warningCodes).toEqual([
      'EVENT_FIELD_TYPE_CHANGED',
      'EVENT_FIELD_REQUIREDNESS_CHANGED',
      'EVENT_FIELD_RENAMED',
    ]);
    expect(ws.getContext()?.draft?.ops).toHaveLength(0);
  });

  test('description, required-to-optional, no-op, and add remain unguarded', () => {
    const ws = fixture(true);

    expect(routeCommand(ws, ['evt', 'field', 'edit', eventId, fieldId, '--description', 'Current order state']).ok).toBe(true);
    expect(routeCommand(ws, ['evt', 'field', 'edit', eventId, fieldId, '--optional']).ok).toBe(true);
    const opCount = ws.getContext()!.draft!.ops.length;
    const noOp = routeCommand(ws, ['evt', 'field', 'edit', eventId, fieldId, '--optional']);
    expect(noOp.ok).toBe(true);
    expect(noOp.data.changed).toBe(false);
    expect(ws.getContext()!.draft!.ops).toHaveLength(opCount);
    expect(routeCommand(ws, [
      'evt', 'field', 'add', eventId,
      '--field-id', 'note', '--name', 'note', '--type', 'string', '--optional',
    ]).ok).toBe(true);
  });

  test('--suppress-warning applies once, records structured intent, and preserves Draft Review warnings', () => {
    const ws = fixture(false);
    const result = routeCommand(ws, [
      'evt', 'field', 'edit', eventId, fieldId,
      '--type', 'OrderStatus',
      '--suppress-warning',
    ]);

    expect(result.ok).toBe(true);
    expect(result.warnings.join('\n')).toContain('explicitly bypassed with --suppress-warning');
    expect(ws.getContext()?.draft?.ops).toHaveLength(1);
    expect(ws.getContext()?.draft?.ops[0]?.details).toEqual({
      compatibilityGuard: {
        acknowledged: true,
        source: 'suppress-warning',
        warningCodes: ['EVENT_FIELD_TYPE_CHANGED'],
      },
    });

    const review = routeCommand(ws, ['review', 'impact', 'draft']);
    const impact = review.data.impact as DraftImpactAnalysis;
    expect(impact.compatibilityWarnings.find(warning => warning.code === 'EVENT_FIELD_TYPE_CHANGED')).toMatchObject({
      acknowledgement: {
        acknowledged: true,
        source: 'suppress-warning',
        warningCodes: ['EVENT_FIELD_TYPE_CHANGED'],
      },
    });
  });

  test('suppression on an unguarded edit does not fabricate acknowledgement or warnings', () => {
    const ws = fixture(false);
    const result = routeCommand(ws, [
      'evt', 'field', 'edit', eventId, fieldId,
      '--description', 'Clarified',
      '--suppress-warning',
    ]);

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(ws.getContext()?.draft?.ops[0]?.details).toBeUndefined();
  });

  test('near-miss and valued suppression flags do not bypass the guard', () => {
    const ws = fixture(false);
    const before = persistedState(ws);

    const misspelled = routeCommand(ws, [
      'evt', 'field', 'edit', eventId, fieldId,
      '--type', 'OrderStatus', '--supress-warning',
    ]);
    const valued = routeCommand(ws, [
      'evt', 'field', 'rm', eventId, fieldId,
      '--suppress-warning', 'true',
    ]);

    expect(misspelled.error?.code).toBe('UNKNOWN_FLAG');
    expect(valued.error?.code).toBe('INVALID_ARGUMENT');
    expect(persistedState(ws)).toBe(before);
  });

  test.each([
    ['stdin', false, true],
    ['stderr', true, false],
  ])('non-TTY %s returns immediately with structured confirmation-required data', async (_stream, stdinIsTTY, stderrIsTTY) => {
    const ws = fixture(false);
    let reads = 0;
    const result = await executeRoutedCommand(ws, [
      'evt', 'field', 'rm', eventId, fieldId,
    ], terminal(stdinIsTTY, stderrIsTTY, async () => {
      reads += 1;
      return 'yes';
    }));

    expect(result.error?.code).toBe('EVENT_SCHEMA_EVOLUTION_CONFIRMATION_REQUIRED');
    expect(result.error?.details).toMatchObject({ eventId, fieldId, warningCodes: ['EVENT_FIELD_REMOVED'] });
    expect(reads).toBe(0);
    expect(ws.getContext()?.draft?.ops).toHaveLength(0);
  });

  test('TTY yes applies exactly once and records interactive confirmation', async () => {
    const ws = fixture(false);
    const stderr: string[] = [];
    let reads = 0;
    const result = await executeRoutedCommand(ws, [
      'evt', 'field', 'edit', eventId, fieldId, '--type', 'OrderStatus',
    ], terminal(true, true, async () => {
      reads += 1;
      return ' YES ';
    }, stderr));

    expect(result.ok).toBe(true);
    expect(reads).toBe(1);
    expect(stderr.join('')).toContain('Continue?');
    expect(stderr.join('')).toContain('EVENT_FIELD_TYPE_CHANGED');
    expect(result.warnings.join('\n')).toContain('interactive confirmation');
    expect(ws.getContext()?.draft?.ops).toHaveLength(1);
    expect(ws.getContext()?.draft?.ops[0]?.details).toEqual({
      compatibilityGuard: {
        acknowledged: true,
        source: 'interactive-confirmation',
        warningCodes: ['EVENT_FIELD_TYPE_CHANGED'],
      },
    });
  });

  test.each([
    ['No', 'n'],
    ['empty input', ''],
    ['invalid response', 'later'],
    ['EOF', null],
  ])('TTY %s cancels with zero writes', async (_label, answer) => {
    const ws = fixture(false);
    const before = persistedState(ws);
    const result = await executeRoutedCommand(ws, [
      'evt', 'field', 'rm', eventId, fieldId,
    ], terminal(true, true, async () => answer));

    expect(result.error?.code).toBe('EVENT_SCHEMA_EVOLUTION_CANCELLED');
    expect(persistedState(ws)).toBe(before);
  });
});

function terminal(
  stdinIsTTY: boolean,
  stderrIsTTY: boolean,
  readLine: (prompt: string) => Promise<string | null>,
  writes: string[] = [],
): EventGuardTerminal {
  return {
    stdinIsTTY,
    stderrIsTTY,
    writeStderr: text => writes.push(text),
    readLine: async prompt => {
      writes.push(prompt);
      return readLine(prompt);
    },
  };
}
