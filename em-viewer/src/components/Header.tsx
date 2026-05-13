interface HeaderProps {
  projectName: string;
  walkCount: number;
  activeRootName: string | null;
}

export function Header({ projectName, walkCount, activeRootName }: HeaderProps) {
  return (
    <div className="overlay header">
      <h1>🏨 {projectName} — <span>Event Modeling</span></h1>
      <p>
        Infinite Canvas Layout · Walk #{walkCount} · Drag to pan · Scroll to zoom
        {activeRootName && (
          <> · <span className="active-flow-label">Flow: {activeRootName}</span></>
        )}
      </p>
    </div>
  );
}
