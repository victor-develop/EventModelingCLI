import type { VisualizationSnapshot } from '../src/viewer-contract';
import {
  renderInvariantSummary,
  renderLayoutAscii,
  renderLayoutTable,
} from '../src/terminal-viewer';
import { readCodeFence, readJsonFence, specFixturePath } from './fixture-utils';

const TERMINAL_CASES = [
  { name: 'TC01 minimal linear flow', dir: 'tc01-minimal-linear-flow', expectedPass: true },
  { name: 'TC02 event fan-out', dir: 'tc02-event-fan-out', expectedPass: true },
  { name: 'TC03 command fan-in', dir: 'tc03-command-fan-in', expectedPass: true },
  { name: 'TC04 duplicate occurrences', dir: 'tc04-duplicate-occurrences', expectedPass: true },
  { name: 'TC05 invalid edge endpoint', dir: 'tc05-invalid-edge-endpoint', expectedPass: false },
  { name: 'TC06 non-LTR edge route', dir: 'tc06-non-ltr-edge-route', expectedPass: false },
  { name: 'TC07 lane normalization', dir: 'tc07-lane-normalization', expectedPass: true },
  { name: 'TC08 locked occurrence', dir: 'tc08-locked-occurrence', expectedPass: true },
];

describe('terminal viewer contract fixtures', () => {
  test.each(TERMINAL_CASES)('$name renders exact ASCII and table output', ({ dir, expectedPass }) => {
    const caseRoot = specFixturePath('03-terminal-viewer-contract-test', dir);
    const snapshot = readJsonFence<VisualizationSnapshot>(`${caseRoot}/input-visualizationsnapshot.md`);
    const expectedAscii = readCodeFence(`${caseRoot}/output-ascii-graph.md`);
    const expectedTable = readCodeFence(`${caseRoot}/output-table.md`);

    expect(renderLayoutAscii(snapshot)).toBe(expectedAscii);
    expect(renderLayoutTable(snapshot)).toBe(expectedTable);
    expect(renderLayoutAscii(snapshot)).toBe(renderLayoutAscii(snapshot));
    expect(renderLayoutTable(snapshot)).toBe(renderLayoutTable(snapshot));

    const summary = renderInvariantSummary(snapshot);
    const allPass = Object.values(summary).every((status) => status === 'PASS');
    expect(allPass).toBe(expectedPass);
  });
});
