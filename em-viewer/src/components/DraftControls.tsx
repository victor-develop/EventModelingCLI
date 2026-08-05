import { GitBranch, GitCompareArrows } from 'lucide-react';
import type { SnapshotDiffMode, SnapshotGraphMode } from '@em/viewer-contract/types';
import type { DraftsResponse } from '../hooks/useGraphData';
import type { LayoutRequest } from '../hooks/layoutRequest';

interface DraftControlsProps {
  draftsData: DraftsResponse | null;
  request: LayoutRequest | null;
  onNavigate: (request: LayoutRequest, mode?: 'push' | 'replace') => void;
}

const GRAPH_MODES: Array<Extract<SnapshotGraphMode, 'base' | 'compare' | 'after'>> = ['base', 'compare', 'after'];
const DIFF_MODES: SnapshotDiffMode[] = ['overlay', 'off'];

export function DraftControls({ draftsData, request, onNavigate }: DraftControlsProps) {
  if (!draftsData || !request) return null;

  const currentRequest = request;
  const selectableDrafts = draftsData.drafts.filter(draft => draft.status === 'open');
  if (selectableDrafts.length === 0) return null;

  const selectedDraft = currentRequest.draft === 'active'
    ? draftsData.activeDraftId ?? ''
    : selectableDrafts.some(draft => draft.id === currentRequest.draft)
      ? currentRequest.draft ?? ''
      : '';
  const hasDraftContext = Boolean(selectedDraft);
  const graph = currentRequest.graph === 'base' || currentRequest.graph === 'after' || currentRequest.graph === 'compare'
    ? currentRequest.graph
    : 'compare';
  const diff = currentRequest.diff ?? 'overlay';

  function updateDraft(draftId: string): void {
    if (!draftId) {
      const { draft: _draft, graph: _graph, diff: _diff, ...currentModelRequest } = currentRequest;
      onNavigate(currentModelRequest, 'push');
      return;
    }
    onNavigate({
      ...currentRequest,
      draft: draftId,
      graph: currentRequest.graph && currentRequest.graph !== 'current' ? currentRequest.graph : 'compare',
      diff: currentRequest.diff ?? 'overlay',
    }, 'push');
  }

  function updateGraph(nextGraph: SnapshotGraphMode): void {
    if (!currentRequest.draft) return;
    onNavigate({ ...currentRequest, graph: nextGraph, diff: currentRequest.diff ?? 'overlay' }, 'push');
  }

  function updateDiff(nextDiff: SnapshotDiffMode): void {
    if (!currentRequest.draft) return;
    onNavigate({ ...currentRequest, diff: nextDiff }, 'replace');
  }

  return (
    <div className="overlay draft-controls">
      <label className="draft-select">
        <GitBranch size={14} aria-hidden="true" />
        <select
          value={selectedDraft}
          aria-label="Draft"
          onChange={(event) => updateDraft(event.target.value)}
        >
          <option value="">Current model</option>
          {selectableDrafts.map((draft) => (
            <option key={draft.id} value={draft.id}>
              {draft.id} · {draft.status}
            </option>
          ))}
        </select>
      </label>
      {hasDraftContext && (
        <>
          <div className="draft-segment" role="tablist" aria-label="Draft graph">
            {GRAPH_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={graph === mode}
                className={graph === mode ? 'is-active' : undefined}
                onClick={() => updateGraph(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="draft-segment compact" role="tablist" aria-label="Diff overlay">
            <GitCompareArrows size={14} aria-hidden="true" />
            {DIFF_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={diff === mode}
                className={diff === mode ? 'is-active' : undefined}
                onClick={() => updateDiff(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
