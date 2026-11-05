import type { VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';

type DiffPresentationSnapshot = Pick<VisualizationSnapshot, 'draft' | 'diffOverlay'>;

export function isCompareOverlayActive(snapshot: DiffPresentationSnapshot): boolean {
  return snapshot.draft?.graph === 'compare'
    && snapshot.draft.diff === 'overlay'
    && Boolean(snapshot.diffOverlay);
}
