import { useState } from 'react';
import { ChevronLeft, ChevronRight, CircleDot, Eye, EyeOff } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DiffStatus, ViewerDiffChange, VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';

interface DiffPanelProps {
  snapshot: VisualizationSnapshot;
  selectedChangeIds: string[];
  onSelectChangeIds: (changeIds: string[]) => void;
}

export function DiffPanel({ snapshot, selectedChangeIds, onSelectChangeIds }: DiffPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const overlay = snapshot.diffOverlay;
  if (!overlay || !snapshot.draft || snapshot.draft.diff === 'off') return null;

  if (collapsed) {
    return (
      <button
        type="button"
        className="overlay diff-panel-toggle"
        aria-label="Expand draft diff"
        title="Expand draft diff"
        onClick={() => setCollapsed(false)}
      >
        <Eye size={14} aria-hidden="true" />
        <span>{snapshot.draft.id}</span>
        <strong>{overlay.summary.totalChanges ?? 0}</strong>
        <ChevronLeft size={15} aria-hidden="true" />
      </button>
    );
  }

  return (
    <aside className="overlay diff-panel" aria-label="Draft diff">
      <div className="diff-panel-header">
        <div>
          <h3>{snapshot.draft.id}</h3>
          <p>{overlay.summary.totalChanges ?? 0} changes</p>
        </div>
        <div className="diff-panel-actions">
          <span className="diff-pill">{snapshot.draft.graph}</span>
          <button
            type="button"
            className="icon-button diff-panel-collapse"
            aria-label="Collapse draft diff"
            title="Collapse draft diff"
            onClick={() => setCollapsed(true)}
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      <DiffSection
        icon={<Eye size={14} aria-hidden="true" />}
        title="Visible"
        changes={overlay.visibleChanges}
        selectedChangeIds={selectedChangeIds}
        onSelectChangeIds={onSelectChangeIds}
      />
      <DiffSection
        icon={<EyeOff size={14} aria-hidden="true" />}
        title="Hidden"
        changes={overlay.hiddenChanges}
        selectedChangeIds={selectedChangeIds}
        onSelectChangeIds={onSelectChangeIds}
      />
    </aside>
  );
}

function DiffSection({
  icon,
  title,
  changes,
  selectedChangeIds,
  onSelectChangeIds,
}: {
  icon: ReactNode;
  title: string;
  changes: ViewerDiffChange[];
  selectedChangeIds: string[];
  onSelectChangeIds: (changeIds: string[]) => void;
}) {
  return (
    <section className="diff-section">
      <div className="diff-section-title">
        {icon}
        <span>{title}</span>
        <strong>{changes.length}</strong>
      </div>
      <div className="diff-change-list">
        {changes.map((change) => (
          <button
            key={change.id}
            type="button"
            className={`diff-change ${selectedChangeIds.includes(change.id) ? 'is-active' : ''}`}
            onClick={() => onSelectChangeIds([change.id])}
          >
            <StatusDot status={change.status} />
            <span>{change.title}</span>
          </button>
        ))}
        {changes.length === 0 && (
          <div className="diff-empty">None</div>
        )}
      </div>
    </section>
  );
}

function StatusDot({ status }: { status: DiffStatus }) {
  return (
    <CircleDot
      size={12}
      aria-hidden="true"
      className={`diff-status-dot diff-${status}`}
    />
  );
}
