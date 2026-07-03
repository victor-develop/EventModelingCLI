import type { Node, NodeChange } from '@xyflow/react';

export type CanvasCommand =
  | { type: 'node.move'; nodeId: string }
  | { type: 'node.move.blocked'; nodeId: string; reason: 'lane' | 'hard-lock' };

export function guardNodeChanges(args: {
  changes: NodeChange[];
  nodes: Node[];
}): {
  changes: NodeChange[];
  commands: CanvasCommand[];
} {
  const nodeById = new Map(args.nodes.map((node) => [node.id, node]));
  const commands: CanvasCommand[] = [];
  const safeChanges: NodeChange[] = [];

  for (const change of args.changes) {
    if (change.type !== 'position') {
      safeChanges.push(change);
      continue;
    }

    const node = nodeById.get(change.id);
    if (!node) continue;
    if (node.id.startsWith('lane:')) {
      commands.push({ type: 'node.move.blocked', nodeId: node.id, reason: 'lane' });
      continue;
    }
    if ((node.data as { lockLevel?: string } | undefined)?.lockLevel === 'hard') {
      commands.push({ type: 'node.move.blocked', nodeId: node.id, reason: 'hard-lock' });
      continue;
    }

    commands.push({ type: 'node.move', nodeId: node.id });
    safeChanges.push(change);
  }

  return { changes: safeChanges, commands };
}
