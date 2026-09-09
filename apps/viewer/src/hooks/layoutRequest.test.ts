import { afterEach, describe, expect, test } from 'vitest';
import {
  defaultLayoutRequest,
  layoutRequestToApiSearchParams,
  readLayoutRequestFromLocation,
  walkLayoutRequest,
  writeLayoutRequestToLocation,
} from './layoutRequest';

describe('layoutRequest URL helpers', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  test('reads shareable layout params from the current URL', () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&direction=backward&hops=3');

    expect(readLayoutRequestFromLocation('ui.screen.fallback')).toEqual({
      focus: 'ui.screen.return-detail',
      direction: 'backward',
      hops: 3,
      includeTruncatedPaths: false,
    });
  });

  test('reads includeTruncatedPaths from shareable URLs', () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&includeTruncatedPaths=true');

    expect(readLayoutRequestFromLocation('ui.screen.fallback')).toEqual({
      focus: 'ui.screen.return-detail',
      direction: 'both',
      hops: 2,
      includeTruncatedPaths: true,
    });
  });

  test('falls back to a default root and bounded defaults for invalid params', () => {
    window.history.replaceState(null, '', '/?direction=sideways&hops=-4');

    expect(readLayoutRequestFromLocation('ui.screen.return-lookup')).toEqual({
      focus: 'ui.screen.return-lookup',
      direction: 'both',
      hops: 2,
      includeTruncatedPaths: false,
    });
  });

  test('writes walk params for share links while preserving unrelated params', () => {
    window.history.replaceState(null, '', '/?theme=dark');

    writeLayoutRequestToLocation(walkLayoutRequest('returns.view.order-summary', 'forward', 5));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('theme')).toBe('dark');
    expect(params.get('focus')).toBe('returns.view.order-summary');
    expect(params.get('direction')).toBe('forward');
    expect(params.get('hops')).toBe('5');
    expect(params.has('includeTruncatedPaths')).toBe(false);
  });

  test('clamps URL hops to the supported range', () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&direction=forward&hops=99');

    expect(readLayoutRequestFromLocation('ui.screen.fallback')).toEqual({
      focus: 'ui.screen.return-detail',
      direction: 'forward',
      hops: 6,
      includeTruncatedPaths: false,
    });
  });

  test('accepts a runtime hop max for larger graphs', () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&direction=forward&hops=99');

    expect(readLayoutRequestFromLocation('ui.screen.fallback', 24)).toEqual({
      focus: 'ui.screen.return-detail',
      direction: 'forward',
      hops: 24,
      includeTruncatedPaths: false,
    });

    expect(walkLayoutRequest('ui.screen.return-detail', 'forward', 18, false, 24)).toEqual({
      focus: 'ui.screen.return-detail',
      direction: 'forward',
      hops: 18,
      includeTruncatedPaths: false,
    });
  });

  test('omits default direction and hops for base focus URLs', () => {
    window.history.replaceState(null, '', '/?focus=old&direction=forward&hops=3');

    writeLayoutRequestToLocation(defaultLayoutRequest('ui.screen.app-installation'));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('focus')).toBe('ui.screen.app-installation');
    expect(params.has('direction')).toBe(false);
    expect(params.has('hops')).toBe(false);
    expect(params.has('includeTruncatedPaths')).toBe(false);
  });

  test('always includes direction and hops for API requests', () => {
    const params = layoutRequestToApiSearchParams(defaultLayoutRequest('ui.screen.return-lookup'));

    expect(params.get('focus')).toBe('ui.screen.return-lookup');
    expect(params.get('direction')).toBe('both');
    expect(params.get('hops')).toBe('2');
    expect(params.get('includeTruncatedPaths')).toBe('false');
  });

  test('writes includeTruncatedPaths when all paths are requested', () => {
    window.history.replaceState(null, '', '/?focus=old');

    writeLayoutRequestToLocation({
      ...defaultLayoutRequest('returns.proc.public-api'),
      includeTruncatedPaths: true,
    });

    const params = new URLSearchParams(window.location.search);
    expect(params.get('focus')).toBe('returns.proc.public-api');
    expect(params.get('includeTruncatedPaths')).toBe('true');
  });

  test('reads draft compare overlay params from shareable URLs', () => {
    window.history.replaceState(null, '', '/?focus=returns.proc.public-api&draft=draft_001&graph=compare&diff=overlay');

    expect(readLayoutRequestFromLocation('ui.screen.fallback')).toEqual({
      focus: 'returns.proc.public-api',
      direction: 'both',
      hops: 2,
      includeTruncatedPaths: false,
      draft: 'draft_001',
      graph: 'compare',
      diff: 'overlay',
    });
  });

  test('walk requests preserve draft graph and diff context', () => {
    expect(walkLayoutRequest(
      'returns.view.order-summary',
      'forward',
      5,
      true,
      12,
      {
        focus: 'returns.proc.public-api',
        direction: 'both',
        hops: 2,
        includeTruncatedPaths: true,
        draft: 'draft_001',
        graph: 'compare',
        diff: 'overlay',
      },
    )).toEqual({
      focus: 'returns.view.order-summary',
      direction: 'forward',
      hops: 5,
      includeTruncatedPaths: true,
      draft: 'draft_001',
      graph: 'compare',
      diff: 'overlay',
    });
  });
});
