import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { ArrowDown, X } from 'lucide-react';
import type {
  DiffStatus,
  ViewerDiffChange,
  ViewerDiffFieldChange,
} from 'event-modeling-spec-cli/viewer-contract/types';
import type { VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';
import { redactDiffValue } from 'event-modeling-spec-cli/viewer-contract/redaction';
import { nodeVisualMeta, nodeVisualKindFromType } from '../xyflow/components/nodeVisualKind';
import {
  buildDiffVisual,
  type DiffVisual,
  type VisualDiffNode,
  type VisualEdgeVariant,
} from './diffVisuals';

interface DiffDrawerProps {
  changeIds: string[];
  changesById: Map<string, ViewerDiffChange>;
  snapshot: Pick<VisualizationSnapshot, 'domainNodes'>;
  onSelectChangeIds: (changeIds: string[]) => void;
  onClose: () => void;
}

export function DiffDrawer({
  changeIds,
  changesById,
  snapshot,
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
  const visual = useMemo(() => (
    activeChange ? buildDiffVisual(activeChange, snapshot.domainNodes) : null
  ), [activeChange, snapshot.domainNodes]);

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
        <h3>Model Change</h3>
        {visual ? (
          <DiffModelVisual visual={visual} />
        ) : (
          <p className="diff-model-empty">
            A structured model preview is not available for this change type.
          </p>
        )}
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

      <details className="diff-technical-payload" open={!visual}>
        <summary>Technical payload</summary>
        <div className="diff-json-pair">
          <JsonBlock title="Before" value={activeChange.before} status={activeChange.status} />
          <JsonBlock title="After" value={activeChange.after} status={activeChange.status} />
        </div>
      </details>
    </aside>
  );
}

function DiffModelVisual({ visual }: { visual: DiffVisual }) {
  if (visual.kind === 'edge') {
    return (
      <div className={`diff-model-change diff-${visual.status}`}>
        {visual.variants.map((variant, index) => (
          <EdgeModelVariant
            key={`${variant.label ?? 'edge'}:${variant.edgeType}:${index}`}
            variant={variant}
            status={visual.status}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`diff-model-change diff-${visual.status}`}>
      {visual.variants.map((variant, index) => (
        <NodeModelVariant
          key={`${variant.label ?? 'node'}:${variant.node.id}:${index}`}
          label={variant.label}
          node={variant.node}
        />
      ))}
    </div>
  );
}

function EdgeModelVariant({
  variant,
  status,
}: {
  variant: VisualEdgeVariant;
  status: DiffStatus;
}) {
  return (
    <figure
      className={`diff-model-variant diff-${status}`}
      aria-label={`${variant.from.label} ${variant.relation} ${variant.to.label}`}
    >
      {variant.label && <figcaption>{variant.label}</figcaption>}
      <ModelNodeBlock node={variant.from} />
      <div className="diff-model-connector">
        <span className="diff-model-arrow" aria-hidden="true">
          <ArrowDown size={16} />
        </span>
        <div className="diff-model-relation">
          <strong title={variant.edgeType}>{variant.relation}</strong>
          {variant.via && (
            <span>
              via <span className="diff-model-via">{variant.via.label}</span>
            </span>
          )}
          {variant.fieldRefs.length > 0 && (
            <div className="diff-model-fields" aria-label="Referenced fields">
              <span>Fields</span>
              {variant.fieldRefs.map(fieldRef => (
                <code key={fieldRef}>{fieldRef}</code>
              ))}
            </div>
          )}
        </div>
      </div>
      <ModelNodeBlock node={variant.to} />
    </figure>
  );
}

function NodeModelVariant({ label, node }: { label?: string; node: VisualDiffNode }) {
  return (
    <figure className="diff-model-variant diff-node-change" aria-label={`${node.label} node`}>
      {label && <figcaption>{label}</figcaption>}
      <ModelNodeBlock node={node} />
    </figure>
  );
}

function ModelNodeBlock({ node }: { node: VisualDiffNode }) {
  const kind = nodeVisualKindFromType(node.kind);
  const visual = nodeVisualMeta(kind);
  const Icon = visual.Icon;
  const style = {
    '--diff-node-color': visual.color,
  } as CSSProperties;

  return (
    <div className="diff-model-node" style={style} title={node.id}>
      <span className="diff-model-node-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="diff-model-node-copy">
        <strong>{node.label}</strong>
        <span>{visual.legendLabel}</span>
      </span>
    </div>
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
