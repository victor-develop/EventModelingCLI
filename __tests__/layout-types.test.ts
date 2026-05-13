import { toDisplayLane, toDisplayNodeKind, DisplayNodeKind, DisplayLane, DisplayRole } from '../src/layout/types';

describe('layout types helpers', () => {
  test('toDisplayLane maps cmd to commandViewModel', () => {
    expect(toDisplayLane('cmd')).toBe('commandViewModel');
  });

  test('toDisplayLane maps evt to event', () => {
    expect(toDisplayLane('evt')).toBe('event');
  });

  test('toDisplayLane maps viewModel to commandViewModel', () => {
    expect(toDisplayLane('viewModel')).toBe('commandViewModel');
  });

  test('toDisplayLane maps shared to nonRole', () => {
    expect(toDisplayLane('shared')).toBe('nonRole');
  });

  test('toDisplayNodeKind maps ui.screen to shared', () => {
    expect(toDisplayNodeKind('ui.screen')).toBe('shared');
  });

  test('toDisplayNodeKind maps ui.form to shared', () => {
    expect(toDisplayNodeKind('ui.form')).toBe('shared');
  });

  test('toDisplayNodeKind maps trigger to shared', () => {
    expect(toDisplayNodeKind('trigger')).toBe('shared');
  });

  test('toDisplayNodeKind maps proc to shared', () => {
    expect(toDisplayNodeKind('proc')).toBe('shared');
  });

  test('toDisplayNodeKind maps cmd to cmd', () => {
    expect(toDisplayNodeKind('cmd')).toBe('cmd');
  });

  test('toDisplayNodeKind maps evt to evt', () => {
    expect(toDisplayNodeKind('evt')).toBe('evt');
  });

  test('toDisplayNodeKind maps viewModel to viewModel', () => {
    expect(toDisplayNodeKind('viewModel')).toBe('viewModel');
  });
});
