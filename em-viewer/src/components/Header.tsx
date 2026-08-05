import type { DraftContext } from '@em/viewer-contract/types';

interface HeaderProps {
  projectName: string;
  walkCount: number;
  activeRootName: string | null;
  draft?: DraftContext;
}

export function Header({ projectName, walkCount, activeRootName, draft }: HeaderProps) {
  return (
    <div className="overlay header">
      <h1>{projectName} <span>Event Modeling</span></h1>
      <p>
        Infinite Canvas Layout / Walk #{walkCount}
        {activeRootName && (
          <> / <span className="active-flow-label">Flow: {activeRootName}</span></>
        )}
        {draft && (
          <> / <span className="active-draft-label">{draft.id}: {draft.graph}</span></>
        )}
      </p>
    </div>
  );
}
