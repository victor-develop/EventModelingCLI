import './App.css';
import { useState, useCallback, useMemo } from 'react';
import { useGraphData } from './hooks/useGraphData';
import { useWalkState } from './hooks/useWalkState';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { WalkControls } from './components/WalkControls';
import { FlowNavigator } from './components/FlowNavigator';
import { XyflowCanvas } from './xyflow/components/XyflowCanvas';

function App() {
  const { data, rootsData, loading, switching, error, refocus } = useGraphData();
  const {
    snapshot: walkSnapshot,
    walkLeft,
    walkRight,
    setOccurrenceLock,
    resetOccurrencePosition,
    canWalkLeft,
    canWalkRight,
    walkCount,
    isWalking,
  } = useWalkState(data);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const visibleSnapshot = walkSnapshot ?? data;

  const activeRootId = useMemo(() => visibleSnapshot?.focusNodeId ?? null, [visibleSnapshot]);
  const activeRootName = useMemo(() => {
    if (!activeRootId) return null;
    const root = rootsData?.roots.find(r => r.canonicalId === activeRootId);
    return root?.displayName ?? visibleSnapshot?.domainNodes[activeRootId]?.displayName ?? activeRootId;
  }, [visibleSnapshot?.domainNodes, rootsData, activeRootId]);

  const projectName = useMemo(() => {
    return visibleSnapshot?.projectName ?? rootsData?.projectName ?? 'Event Modeling';
  }, [visibleSnapshot, rootsData]);

  const handleWalkLeft = useCallback(() => {
    walkLeft();
  }, [walkLeft]);

  const handleWalkRight = useCallback(() => {
    walkRight();
  }, [walkRight]);

  const handleSelectRoot = useCallback((canonicalId: string) => {
    if (canonicalId === activeRootId) return;
    refocus(canonicalId);
  }, [refocus, activeRootId]);

  if (loading) {
    return (
      <div className="app-state">
        Loading graph data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-state">
        Error: {error}
      </div>
    );
  }

  if (!visibleSnapshot) {
    return (
      <div className="app-state">
        Initializing layout…
      </div>
    );
  }

  return (
    <>
      <Header projectName={projectName} walkCount={walkCount} activeRootName={activeRootName} />
      <Legend />
      {rootsData && rootsData.roots.length > 0 && (
        <FlowNavigator
          roots={rootsData.roots}
          activeRootId={activeRootId}
          onSelectRoot={handleSelectRoot}
          collapsed={navCollapsed}
          onToggleCollapse={() => setNavCollapsed(c => !c)}
        />
      )}
      <WalkControls
        onWalkLeft={handleWalkLeft}
        onWalkRight={handleWalkRight}
        canWalkLeft={canWalkLeft}
        canWalkRight={canWalkRight}
        isWalking={switching || isWalking}
      />
      <XyflowCanvas
        snapshot={visibleSnapshot}
        onOccurrenceLockChange={setOccurrenceLock}
        onOccurrenceReset={resetOccurrencePosition}
        onExploreLeft={handleWalkLeft}
        onExploreRight={handleWalkRight}
      />
      {(switching || isWalking) && (
        <div className="switching-overlay">
          <div className="switching-spinner" />
        </div>
      )}
    </>
  );
}

export default App;
