interface WalkControlsProps {
  onWalkLeft: () => void;
  onWalkRight: () => void;
  canWalkLeft: boolean;
  canWalkRight: boolean;
  isWalking: boolean;
}

export function WalkControls({ onWalkLeft, onWalkRight, canWalkLeft, canWalkRight, isWalking }: WalkControlsProps) {
  return (
    <div className="overlay walk-controls">
      <button onClick={onWalkLeft} disabled={!canWalkLeft || isWalking} title="Walk left (expand 3 edges backward)">
        ◀ Walk Left
      </button>
      <button onClick={onWalkRight} disabled={!canWalkRight || isWalking} title="Walk right (expand 3 edges forward)">
        Walk Right ▶
      </button>
      {isWalking && <span className="walk-status">Walking…</span>}
    </div>
  );
}
