import { describe, expect, test } from 'vitest';
import type { Node, NodeChange } from '@xyflow/react';
import { guardNodeChanges } from './nodeChangeGuard';

describe('guardNodeChanges', () => {
  test('blocks lane and hard-locked node movement', () => {
    const nodes: Node[] = [
      { id: 'lane:shared', position: { x: 0, y: 0 }, data: {} },
      { id: 'occ-a', position: { x: 10, y: 10 }, data: { lockLevel: 'hard' } },
      { id: 'occ-b', position: { x: 20, y: 20 }, data: { lockLevel: 'none' } },
    ];
    const changes: NodeChange[] = [
      { id: 'lane:shared', type: 'position', position: { x: 1, y: 1 } },
      { id: 'occ-a', type: 'position', position: { x: 11, y: 11 } },
      { id: 'occ-b', type: 'position', position: { x: 21, y: 21 } },
      { id: 'occ-b', type: 'select', selected: true },
    ];

    const result = guardNodeChanges({ nodes, changes });

    expect(result.changes).toEqual([
      { id: 'occ-b', type: 'position', position: { x: 21, y: 21 } },
      { id: 'occ-b', type: 'select', selected: true },
    ]);
    expect(result.commands).toEqual([
      { type: 'node.move.blocked', nodeId: 'lane:shared', reason: 'lane' },
      { type: 'node.move.blocked', nodeId: 'occ-a', reason: 'hard-lock' },
      { type: 'node.move', nodeId: 'occ-b' },
    ]);
  });
});
