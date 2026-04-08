import {
  NormalizedPathEnvelope,
  Occurrence,
  DisplayRole,
  toDisplayNodeKind,
  toDisplayLane,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  PathStep,
  PathNode,
  PathEdge,
  MergeKey,
} from './types';

let occCounter = 0;

function nextOccId(): string {
  occCounter++;
  return `occ_${occCounter}`;
}

export function resetOccCounter(): void {
  occCounter = 0;
}

function inferDisplayRole(nodeKind: string): DisplayRole {
  if (nodeKind === 'cmd') return 'command';
  if (nodeKind === 'evt') return 'event';
  if (nodeKind === 'viewModel') return 'projection';
  if (nodeKind === 'trigger') return 'trigger';
  if (nodeKind.startsWith('ui.')) return 'ui';
  if (nodeKind === 'proc') return 'processor';
  return 'ui';
}

export function buildOccurrences(
  envelope: NormalizedPathEnvelope,
  branchOffset: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const seen = new Set<string>();

  for (const branch of envelope.branches) {
    for (const step of branch.path) {
      if (step.type !== 'node') continue;
      const node = step as PathNode;
      const key = `${node.nodeId}:${branch.branchId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const displayKind = toDisplayNodeKind(node.nodeKind);
      const lane = toDisplayLane(displayKind);

      occurrences.push({
        occurrenceId: node.occurrenceId ?? nextOccId(),
        canonicalNodeId: node.nodeId,
        nodeKind: displayKind,
        lane,
        stageIndex: 0,
        rowIndex: -1,
        displayRole: inferDisplayRole(node.nodeKind),
        branchClusterId: branch.branchId,
        lockLevel: 'free',
        x: 0,
        y: 0,
        width: config.nodeWidth,
        height: config.nodeHeight,
      });
    }
  }

  return occurrences;
}

export function mergeOccurrences(
  incoming: Occurrence[],
  existing: Occurrence[],
): { merged: Occurrence[]; added: Occurrence[] } {
  const merged: Occurrence[] = [...existing];
  const added: Occurrence[] = [];

  for (const inc of incoming) {
    const matchIdx = merged.findIndex(e =>
      e.canonicalNodeId === inc.canonicalNodeId &&
      e.stageIndex === inc.stageIndex &&
      e.displayRole === inc.displayRole &&
      e.branchClusterId !== inc.branchClusterId
    );

    if (matchIdx >= 0) {
      continue;
    } else {
      merged.push(inc);
      added.push(inc);
    }
  }

  return { merged, added };
}

export function buildMergeKey(occ: Occurrence): MergeKey {
  return {
    canonicalNodeId: occ.canonicalNodeId,
    stageIndex: occ.stageIndex,
    displayRole: occ.displayRole,
    branchClusterId: occ.branchClusterId,
  };
}

export function buildEdgeOccurrenceLinks(
  envelope: NormalizedPathEnvelope,
  occurrences: Occurrence[],
): Array<{ fromOccId: string; toOccId: string; originalEdgeId: string; originalEdgeType: string }> {
  const links: Array<{ fromOccId: string; toOccId: string; originalEdgeId: string; originalEdgeType: string }> = [];
  const nodeOccMap = new Map<string, string[]>();
  for (const occ of occurrences) {
    const list = nodeOccMap.get(occ.canonicalNodeId) ?? [];
    list.push(occ.occurrenceId);
    nodeOccMap.set(occ.canonicalNodeId, list);
  }

  for (const branch of envelope.branches) {
    const pathSteps = branch.path;
    for (let i = 0; i < pathSteps.length - 2; i++) {
      const node1 = pathSteps[i]!;
      const edge = pathSteps[i + 1]!;
      const node2 = pathSteps[i + 2]!;
      if (node1.type !== 'node' || edge.type !== 'edge' || node2.type !== 'node') continue;

      const fromOccs = nodeOccMap.get((node1 as PathNode).nodeId) ?? [];
      const toOccs = nodeOccMap.get((node2 as PathNode).nodeId) ?? [];

      for (const fromId of fromOccs) {
        for (const toId of toOccs) {
          const fromOcc = occurrences.find(o => o.occurrenceId === fromId);
          const toOcc = occurrences.find(o => o.occurrenceId === toId);
          if (fromOcc?.branchClusterId === branch.branchId && toOcc?.branchClusterId === branch.branchId) {
            links.push({
              fromOccId: fromId,
              toOccId: toId,
              originalEdgeId: (edge as PathEdge).edgeId,
              originalEdgeType: (edge as PathEdge).edgeType,
            });
          }
        }
      }
    }
  }

  return links;
}
