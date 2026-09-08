import './App.css';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { maxLayoutHopsForRoots, useGraphData } from './hooks/useGraphData';
import { useWalkState } from './hooks/useWalkState';
import { DEFAULT_LAYOUT_HOPS, MIN_LAYOUT_HOPS, clampLayoutHops } from './hooks/layoutRequest';
import { readDiffSelectionFromLocation, writeDiffSelectionToLocation } from './hooks/diffSelectionUrl';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { WalkControls } from './components/WalkControls';
import { FlowNavigator } from './components/FlowNavigator';
import { DraftControls } from './components/DraftControls';
import { DiffPanel } from './components/DiffPanel';
import { DiffDrawer } from './components/DiffDrawer';
import { XyflowCanvas } from './xyflow/components/XyflowCanvas';

function App() {
  const { data, rootsData, draftsData, loading, switching, error, layoutRequest, navigateLayout, refocus } = useGraphData();
  const maxLayoutHops = maxLayoutHopsForRoots(rootsData);
  const currentHops = clampLayoutHops(layoutRequest?.hops ?? DEFAULT_LAYOUT_HOPS, maxLayoutHops);
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
  } = useWalkState(data, {
    onNavigate: navigateLayout,
    walkHops: currentHops,
    maxHops: maxLayoutHops,
    includeTruncatedPaths: layoutRequest?.includeTruncatedPaths ?? false,
    requestContext: layoutRequest,
  });
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [selectedDiffChangeIds, setSelectedDiffChangeIds] = useState<string[]>(() => readDiffSelectionFromLocation());
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

  const diffChangesById = useMemo(() => {
    const changes = [
      ...(visibleSnapshot?.diffOverlay?.visibleChanges ?? []),
      ...(visibleSnapshot?.diffOverlay?.hiddenChanges ?? []),
    ];
    return new Map(changes.map(change => [change.id, change]));
  }, [visibleSnapshot?.diffOverlay]);

  useEffect(() => {
    const onPopState = () => {
      setSelectedDiffChangeIds(readDiffSelectionFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (selectedDiffChangeIds.length === 0) return;
    if (!visibleSnapshot) return;
    if (!visibleSnapshot?.diffOverlay) {
      // The selection is URL-backed state and must be cleared when the server removes the overlay.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDiffChangeIds([]);
      writeDiffSelectionToLocation([], 'replace');
      return;
    }
    const available = selectedDiffChangeIds.filter(changeId => diffChangesById.has(changeId));
    if (available.length !== selectedDiffChangeIds.length) {
      setSelectedDiffChangeIds(available);
      writeDiffSelectionToLocation(available, 'replace');
    }
  }, [diffChangesById, selectedDiffChangeIds, visibleSnapshot]);

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

  const handleHopsChange = useCallback((hops: number) => {
    if (!layoutRequest) return;
    navigateLayout({ ...layoutRequest, hops: clampLayoutHops(hops, maxLayoutHops) }, 'replace');
  }, [layoutRequest, maxLayoutHops, navigateLayout]);

  const handleIncludeTruncatedPathsChange = useCallback((includeTruncatedPaths: boolean) => {
    if (!layoutRequest) return;
    navigateLayout({ ...layoutRequest, includeTruncatedPaths }, 'replace');
  }, [layoutRequest, navigateLayout]);

  const handleSelectDiffChangeIds = useCallback((changeIds: string[]) => {
    const available = changeIds.filter(changeId => diffChangesById.has(changeId));
    if (available.length === 0) return;
    setSelectedDiffChangeIds(available);
    writeDiffSelectionToLocation(available, 'push');
  }, [diffChangesById]);

  const handleCloseDiffDrawer = useCallback(() => {
    setSelectedDiffChangeIds([]);
    writeDiffSelectionToLocation([], 'push');
  }, []);

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
      <Header
        projectName={projectName}
        walkCount={walkCount}
        activeRootName={activeRootName}
        draft={visibleSnapshot.draft}
      />
      <Legend />
      <DraftControls
        draftsData={draftsData}
        request={layoutRequest}
        onNavigate={navigateLayout}
      />
      {rootsData && rootsData.roots.length > 0 && (
        <FlowNavigator
          roots={rootsData.roots}
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
        hops={currentHops}
        minHops={MIN_LAYOUT_HOPS}
        maxHops={maxLayoutHops}
        onHopsChange={handleHopsChange}
        includeTruncatedPaths={layoutRequest?.includeTruncatedPaths ?? false}
        hiddenTruncatedPathCount={visibleSnapshot.truncation?.hiddenPathCount ?? 0}
        onIncludeTruncatedPathsChange={handleIncludeTruncatedPathsChange}
      />
      <XyflowCanvas
        snapshot={visibleSnapshot}
        onOccurrenceLockChange={setOccurrenceLock}
        onOccurrenceReset={resetOccurrencePosition}
        onExploreLeft={handleWalkLeft}
        onExploreRight={handleWalkRight}
        onDiffSelect={handleSelectDiffChangeIds}
      />
      <DiffPanel
        snapshot={visibleSnapshot}
        selectedChangeIds={selectedDiffChangeIds}
        onSelectChangeIds={handleSelectDiffChangeIds}
      />
      <DiffDrawer
        changeIds={selectedDiffChangeIds}
        changesById={diffChangesById}
        onSelectChangeIds={handleSelectDiffChangeIds}
        onClose={handleCloseDiffDrawer}
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
