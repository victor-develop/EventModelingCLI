import { LEGEND_NODE_VISUAL_KINDS, nodeVisualMeta } from '../xyflow/components/nodeVisualKind';

export function Legend() {
  return (
    <div className="overlay legend">
      <h3>Node Types</h3>
      {LEGEND_NODE_VISUAL_KINDS.map((kind) => {
        const item = nodeVisualMeta(kind);
        return (
          <div className="legend-item" key={kind}>
            <span className="legend-icon" style={{ color: item.color }}>
              <item.Icon size={14} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <span>{item.legendLabel}</span>
          </div>
        );
      })}
    </div>
  );
}
