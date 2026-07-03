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
    patch,
    domainNodes,
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

  const activeRootId = useMemo(() => data?.focusNodeId ?? null, [data]);
  const activeRootName = useMemo(() => {
    if (!rootsData || !activeRootId) return null;
    const root = rootsData.roots.find(r => r.canonicalId === activeRootId);
    return root?.displayName ?? null;
  }, [rootsData, activeRootId]);

  const projectName = useMemo(() => {
    return data?.projectName ?? rootsData?.projectName ?? 'Event Modeling';
  }, [data, rootsData]);

  const snapshotContext = useMemo(() => ({
    domainNodes,
    laneMap: data?.laneMap ?? {},
  }), [domainNodes, data?.laneMap]);

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

  if (!data) {
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
        snapshot={data}
        patch={patch}
        snapshotContext={snapshotContext}
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
