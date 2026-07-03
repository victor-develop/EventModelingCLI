import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

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
        <ChevronLeft size={16} />
        Walk Left
      </button>
      <button onClick={onWalkRight} disabled={!canWalkRight || isWalking} title="Walk right (expand 3 edges forward)">
        Walk Right
        <ChevronRight size={16} />
      </button>
      {isWalking && <span className="walk-status"><Loader2 size={14} /> Walking...</span>}
    </div>
  );
}
