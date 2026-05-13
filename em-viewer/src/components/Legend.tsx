import { NODE_COLORS } from '../types';

const LEGEND_ITEMS = [
  { color: NODE_COLORS.cmd, label: 'Command' },
  { color: NODE_COLORS.evt, label: 'Event' },
  { color: NODE_COLORS.viewModel, label: 'ViewModel' },
  { color: NODE_COLORS.shared, label: 'UI / Trigger / Proc' },
];

export function Legend() {
  return (
    <div className="overlay legend">
      <h3>Node Types</h3>
      {LEGEND_ITEMS.map(item => (
        <div className="legend-item" key={item.label}>
          <div className="legend-dot" style={{ background: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
