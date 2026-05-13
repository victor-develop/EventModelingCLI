import './App.css';
import { useState, useCallback, useMemo } from 'react';
import { useGraphData, getDisplayName } from './hooks/useGraphData';
import { useWalkState } from './hooks/useWalkState';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { SwimlaneBackground } from './components/SwimlaneBackground';
import { GraphNode } from './components/GraphNode';
import { GraphEdge } from './components/GraphEdge';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { WalkControls } from './components/WalkControls';
import { FlowNavigator } from './components/FlowNavigator';

function App() {
  const { data, rootsData, loading, switching, error, refocus } = useGraphData();
  const { layoutState, nodeMap, walkLeft, walkRight, canWalkLeft, canWalkRight, walkCount } = useWalkState(data);
  const [panRequest, setPanRequest] = useState<'left' | 'right' | null>(null);
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

  const handleWalkLeft = useCallback(() => {
    walkLeft();
    setPanRequest('left');
  }, [walkLeft]);

  const handleWalkRight = useCallback(() => {
    walkRight();
    setPanRequest('right');
  }, [walkRight]);

  const handlePanHandled = useCallback(() => setPanRequest(null), []);

  const handleSelectRoot = useCallback((canonicalId: string) => {
    if (canonicalId === activeRootId) return;
    refocus(canonicalId);
  }, [refocus, activeRootId]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontFamily: 'Inter, sans-serif' }}>
        Loading graph data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e55', fontFamily: 'Inter, sans-serif' }}>
        Error: {error}
      </div>
    );
  }

  if (!layoutState) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontFamily: 'Inter, sans-serif' }}>
        Initializing layout…
      </div>
    );
  }

  const occurrences = Object.values(layoutState.occurrences);
  const edges = Object.values(layoutState.displayEdges);
  const displayNameFn = (nodeId: string) => getDisplayName(nodeMap, nodeId);

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
        isWalking={switching}
      />
      <InfiniteCanvas panRequest={panRequest} onPanHandled={handlePanHandled}>
        {() => (
          <>
            <SwimlaneBackground swimlaneRects={layoutState.swimlaneRects} />
            {edges.map(e => (
              <GraphEdge key={e.displayEdgeId} edge={e} />
            ))}
            {occurrences.map(occ => (
              <GraphNode key={occ.occurrenceId} occurrence={occ} getDisplayName={displayNameFn} />
            ))}
          </>
        )}
      </InfiniteCanvas>
      {switching && (
        <div className="switching-overlay">
          <div className="switching-spinner" />
        </div>
      )}
    </>
  );
}

export default App;
