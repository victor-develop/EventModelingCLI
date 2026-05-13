import type { NormalizedPathEnvelope, Branch, PathStep } from '@em/layout/types';
import type { WalkBranch, WalkStep } from '@em/graph/graph-builder';
import { toDisplayNodeKind } from '@em/layout/types';

export function walkResultToEnvelope(
  walkResult: { branches: WalkBranch[]; frontier?: { hasMore: boolean } },
  anchorNodeId: string,
  laneMap?: Record<string, string>,
): NormalizedPathEnvelope {
  const branches: Branch[] = walkResult.branches
    .filter(b => b.path.length > 1)
    .map((b, i) => {
      const firstEdge = b.path.find(s => s.edgeId && s.direction);
      const dir: 'forward' | 'backward' = firstEdge?.direction === 'backward' ? 'backward' : 'forward';
      return {
        branchId: `walk_${i}`,
        direction: dir,
        path: walkStepsToPathSteps(b.path, laneMap),
      };
    });

  return {
    anchor: { nodeId: anchorNodeId },
    branches,
    frontier: {},
  };
}

function walkStepsToPathSteps(steps: WalkStep[], laneMap?: Record<string, string>): PathStep[] {
  const result: PathStep[] = [];
  for (const step of steps) {
    if (step.nodeId && step.nodeKind) {
      result.push({
        type: 'node',
        nodeId: step.nodeId,
        nodeKind: toDisplayNodeKind(step.nodeKind),
        lane: laneMap?.[step.nodeId],
      });
    } else if (step.edgeId && step.edgeType && step.direction) {
      result.push({
        type: 'edge',
        edgeId: step.edgeId,
        edgeType: step.edgeType,
        displayDirection: step.direction,
      });
    }
  }
  return result;
}
