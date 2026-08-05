import { afterEach, describe, expect, test } from 'vitest';
import { readDiffSelectionFromLocation, writeDiffSelectionToLocation } from './diffSelectionUrl';

describe('diffSelectionUrl', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  test('reads repeated diffChange params from shareable URLs', () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&diffChange=node%3Aa&diffChange=edge%3Ab');

    expect(readDiffSelectionFromLocation()).toEqual(['node:a', 'edge:b']);
  });

  test('writes diff selection without sending it into layout request state', () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&direction=forward&hops=4');

    writeDiffSelectionToLocation(['node:vm.order-detail', 'edge:edge_32'], 'replace');

    const params = new URLSearchParams(window.location.search);
    expect(params.get('focus')).toBe('ui.screen.return-detail');
    expect(params.get('direction')).toBe('forward');
    expect(params.getAll('diffChange')).toEqual(['node:vm.order-detail', 'edge:edge_32']);
  });

  test('clears diff selection while preserving layout params', () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&diffChange=node%3Aa');

    writeDiffSelectionToLocation([], 'replace');

    const params = new URLSearchParams(window.location.search);
    expect(params.get('focus')).toBe('ui.screen.return-detail');
    expect(params.has('diffChange')).toBe(false);
  });
});
