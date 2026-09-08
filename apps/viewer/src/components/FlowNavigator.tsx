import type { RootNodeInfo } from '../types';
import { useMemo, useState } from 'react';
import { PanelLeftOpen, Search, X } from 'lucide-react';

interface FlowNavigatorProps {
  roots: RootNodeInfo[];
  onSelectRoot: (canonicalId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface FlowSuggestion {
  value: string;
  label: string;
  canonicalId: string;
}

export function FlowNavigator({ roots, onSelectRoot, collapsed, onToggleCollapse }: FlowNavigatorProps) {
  const [filterText, setFilterText] = useState('');
  const normalizedFilter = filterText.trim().toLowerCase();
  const suggestions = useMemo<FlowSuggestion[]>(() => {
    const displayNameCounts = roots.reduce<Record<string, number>>((counts, root) => {
      counts[root.displayName] = (counts[root.displayName] ?? 0) + 1;
      return counts;
    }, {});

    return roots.map((root) => {
      const hasDuplicateName = displayNameCounts[root.displayName]! > 1;
      return {
        value: hasDuplicateName ? `${root.displayName} (${root.canonicalId})` : root.displayName,
        label: root.kind === root.canonicalId ? root.kind : `${root.kind} · ${root.canonicalId}`,
        canonicalId: root.canonicalId,
      };
    });
  }, [roots]);
  const exactMatch = useMemo(() => {
    if (!normalizedFilter) return undefined;
    const suggestionMatch = suggestions.find((suggestion) => (
      suggestion.value.toLowerCase() === normalizedFilter ||
      suggestion.canonicalId.toLowerCase() === normalizedFilter
    ));
    return roots.find((root) => root.canonicalId === suggestionMatch?.canonicalId);
  }, [normalizedFilter, roots, suggestions]);

  function selectRoot(canonicalId: string): void {
    setFilterText('');
    onSelectRoot(canonicalId);
  }

  function updateFilterText(value: string): void {
    setFilterText(value);
    const normalizedValue = value.trim().toLowerCase();
    const suggestion = suggestions.find((item) => item.value.toLowerCase() === normalizedValue);
    if (suggestion) selectRoot(suggestion.canonicalId);
  }

  if (collapsed) {
    return (
      <button
        className="flow-nav-toggle"
        onClick={onToggleCollapse}
        title="Show Flows"
      >
        <PanelLeftOpen size={18} />
      </button>
    );
  }

  return (
    <div className="overlay flow-navigator">
      <div className="flow-nav-header">
        <h3>FLOWS</h3>
        <button className="flow-nav-icon-button" onClick={onToggleCollapse} aria-label="Close flows">
          <X size={14} />
        </button>
      </div>
      <div className="flow-nav-search">
        <Search size={14} />
        <input
          type="search"
          value={filterText}
          list="flow-nav-suggestions"
          placeholder="Filter flows"
          aria-label="Filter flows"
          onChange={(event) => updateFilterText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && exactMatch) {
              event.preventDefault();
              selectRoot(exactMatch.canonicalId);
            }
          }}
        />
        {filterText && (
          <button type="button" onClick={() => setFilterText('')} aria-label="Clear flow filter">
            <X size={12} />
          </button>
        )}
      </div>
      <datalist id="flow-nav-suggestions">
        {suggestions.map((suggestion) => (
          <option
            key={suggestion.canonicalId}
            value={suggestion.value}
            label={suggestion.label}
          />
        ))}
      </datalist>
    </div>
  );
}
