import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface WalkControlsProps {
  onWalkLeft: () => void;
  onWalkRight: () => void;
  canWalkLeft: boolean;
  canWalkRight: boolean;
  isWalking: boolean;
  hops: number;
  minHops: number;
  maxHops: number;
  onHopsChange: (hops: number) => void;
  includeTruncatedPaths: boolean;
  hiddenTruncatedPathCount: number;
  onIncludeTruncatedPathsChange: (includeTruncatedPaths: boolean) => void;
}

export function WalkControls({
  onWalkLeft,
  onWalkRight,
  canWalkLeft,
  canWalkRight,
  isWalking,
  hops,
  minHops,
  maxHops,
  onHopsChange,
  includeTruncatedPaths,
  hiddenTruncatedPathCount,
  onIncludeTruncatedPathsChange,
}: WalkControlsProps) {
  return (
    <div className="overlay walk-controls">
      <button onClick={onWalkLeft} disabled={!canWalkLeft || isWalking} title={`Walk left (expand ${hops} edges backward)`}>
        <ChevronLeft size={16} />
        Walk Left
      </button>
      <label className="hop-control">
        <span className="hop-control-value">{hops} hops</span>
        <input
          type="range"
          min={minHops}
          max={maxHops}
          step={1}
          value={hops}
          aria-label="Hop count"
          disabled={isWalking}
          onChange={(event) => onHopsChange(Number(event.target.value))}
        />
      </label>
      <div className="truncated-control" role="tablist" aria-label="Truncated paths">
        <button
          type="button"
          role="tab"
          aria-selected={!includeTruncatedPaths}
          className={!includeTruncatedPaths ? 'is-active' : undefined}
          disabled={isWalking}
          onClick={() => onIncludeTruncatedPathsChange(false)}
          title={`${hiddenTruncatedPathCount} truncated paths hidden`}
        >
          Clean
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={includeTruncatedPaths}
          className={includeTruncatedPaths ? 'is-active' : undefined}
          disabled={isWalking}
          onClick={() => onIncludeTruncatedPathsChange(true)}
          title="Include truncated paths"
        >
          All Paths
        </button>
      </div>
      <button onClick={onWalkRight} disabled={!canWalkRight || isWalking} title={`Walk right (expand ${hops} edges forward)`}>
        Walk Right
        <ChevronRight size={16} />
      </button>
      {isWalking && <span className="walk-status"><Loader2 size={14} /> Walking...</span>}
    </div>
  );
}
