import type { RootNodeInfo } from '../types';

interface FlowNavigatorProps {
  roots: RootNodeInfo[];
  activeRootId: string | null;
  onSelectRoot: (canonicalId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function kindToColor(kind: string): string {
  if (kind.startsWith('ui.')) return '#F39C12';
  switch (kind) {
    case 'cmd': return '#4A90D9';
    case 'trigger': return '#F39C12';
    case 'proc': return '#F39C12';
    default: return '#888';
  }
}

export function FlowNavigator({ roots, activeRootId, onSelectRoot, collapsed, onToggleCollapse }: FlowNavigatorProps) {
  if (collapsed) {
    return (
      <button
        className="flow-nav-toggle"
        onClick={onToggleCollapse}
        title="Show Flows"
      >
        🧭
      </button>
    );
  }

  return (
    <div className="overlay flow-navigator">
      <div className="flow-nav-header">
        <h3>FLOWS</h3>
        <button className="flow-nav-close" onClick={onToggleCollapse}>✕</button>
      </div>
      <div className="flow-nav-list">
        {roots.map(root => {
          const isActive = root.canonicalId === activeRootId;
          return (
            <button
              key={root.canonicalId}
              className={`flow-nav-item${isActive ? ' active' : ''}`}
              onClick={() => onSelectRoot(root.canonicalId)}
            >
              <span
                className="flow-nav-dot"
                style={{ background: kindToColor(root.kind) }}
              />
              <span className="flow-nav-label">{root.displayName}</span>
              <span className="flow-nav-kind">{root.kind}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
