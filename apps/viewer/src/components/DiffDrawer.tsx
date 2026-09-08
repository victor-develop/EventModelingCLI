import { useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import type {
  DiffStatus,
  ViewerDiffChange,
  ViewerDiffFieldChange,
} from 'event-modeling-spec-cli/viewer-contract/types';
import { redactDiffValue } from 'event-modeling-spec-cli/viewer-contract/redaction';

interface DiffDrawerProps {
  changeIds: string[];
  changesById: Map<string, ViewerDiffChange>;
  onSelectChangeIds: (changeIds: string[]) => void;
  onClose: () => void;
}

export function DiffDrawer({
  changeIds,
  changesById,
  onSelectChangeIds,
  onClose,
}: DiffDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const selectedChanges = useMemo(() => (
    changeIds
      .map(changeId => changesById.get(changeId))
      .filter((change): change is ViewerDiffChange => Boolean(change))
  ), [changeIds, changesById]);
  const activeChange = selectedChanges[0];

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [activeChange?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!activeChange) return null;

  return (
    <aside className="diff-drawer" aria-label="Diff detail" role="dialog" aria-modal="false">
      <div className="diff-drawer-header">
        <div>
          <span className={`diff-detail-status diff-${activeChange.status}`}>{activeChange.status}</span>
          <h2>{activeChange.title}</h2>
          <p>{targetLabel(activeChange)}</p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="icon-button diff-drawer-close"
          aria-label="Close diff detail"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      {selectedChanges.length > 1 && (
        <section className="diff-drawer-section">
          <h3>Related Changes</h3>
          <div className="diff-related-list">
            {selectedChanges.map((change) => (
              <button
                key={change.id}
                type="button"
                className={`diff-related-change ${change.id === activeChange.id ? 'is-active' : ''}`}
                onClick={() => onSelectChangeIds([
                  change.id,
                  ...changeIds.filter(changeId => changeId !== change.id),
                ])}
              >
                <span className={`diff-related-dot diff-${change.status}`} />
                <span>{change.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="diff-drawer-section">
        <h3>Summary</h3>
        <dl className="diff-detail-grid">
          <div>
            <dt>Status</dt>
            <dd>{activeChange.status}</dd>
          </div>
          <div>
            <dt>Entity</dt>
            <dd>{activeChange.entityType}</dd>
          </div>
          {activeChange.targetNodeId && (
            <div>
              <dt>Node</dt>
              <dd>{activeChange.targetNodeId}</dd>
            </div>
          )}
          {activeChange.targetEdgeId && (
            <div>
              <dt>Edge</dt>
              <dd>{activeChange.targetEdgeId}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="diff-drawer-section">
        <h3>Field Changes</h3>
        {activeChange.fieldChanges && activeChange.fieldChanges.length > 0 ? (
          <div className="diff-field-change-list">
            {activeChange.fieldChanges.map((fieldChange) => (
              <FieldChangeRow key={`${fieldChange.path}:${fieldChange.status}`} change={fieldChange} />
            ))}
          </div>
        ) : (
          <p className="diff-detail-empty">
            {activeChange.status === 'added'
              ? 'Entity added in this draft.'
              : activeChange.status === 'removed'
                ? 'Entity removed in this draft.'
                : 'No field-level detail available.'}
          </p>
        )}
      </section>

      <section className="diff-drawer-section">
        <h3>Before / After</h3>
        <div className="diff-json-pair">
          <JsonBlock title="Before" value={activeChange.before} status={activeChange.status} />
          <JsonBlock title="After" value={activeChange.after} status={activeChange.status} />
        </div>
      </section>
    </aside>
  );
}

function FieldChangeRow({ change }: { change: ViewerDiffFieldChange }) {
  return (
    <div className="diff-field-change">
      <div className="diff-field-change-topline">
        <span className={`diff-field-status diff-${change.status}`}>{change.status}</span>
        <code>{change.path}</code>
      </div>
      <div className="diff-field-values">
        {change.status !== 'added' && (
          <div>
            <span>Before</span>
            <code>{formatInlineValue(change.before, change.path)}</code>
          </div>
        )}
        {change.status !== 'removed' && (
          <div>
            <span>After</span>
            <code>{formatInlineValue(change.after, change.path)}</code>
          </div>
        )}
      </div>
    </div>
  );
}

function JsonBlock({
  title,
  value,
  status,
}: {
  title: string;
  value: unknown;
  status: DiffStatus;
}) {
  const unavailable = value === undefined || value === null;
  return (
    <div className="diff-json-block">
      <h4>{title}</h4>
      <pre className={unavailable ? `is-empty diff-${status}` : undefined}>
        {unavailable ? 'None' : formatJson(value)}
      </pre>
    </div>
  );
}

function targetLabel(change: ViewerDiffChange): string {
  return change.targetEdgeId ?? change.targetNodeId ?? change.id;
}

function formatInlineValue(value: unknown, path = ''): string {
  const redacted = redactDiffValue(value, path);
  if (redacted === undefined || redacted === null) return 'None';
  if (typeof redacted === 'string') return redacted;
  return formatJson(redacted);
}

function formatJson(value: unknown): string {
  return JSON.stringify(redactDiffValue(value), null, 2);
}
