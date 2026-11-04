import type { VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';

export type WalkDirection = 'forward' | 'backward';
type Occurrence = VisualizationSnapshot['occurrences'][number];

export function findWalkFrontier(
  snapshot: VisualizationSnapshot | null,
  direction: WalkDirection,
): Occurrence | null {
  if (!snapshot) return null;
  const occurrences = snapshot.occurrences.filter(isNavigableOccurrence);
  if (occurrences.length === 0) return null;

  const preferHighStage = direction === 'forward';
  return [...occurrences].sort((a, b) => (
    preferHighStage
      ? (b.stageIndex - a.stageIndex) || (b.x - a.x)
      : (a.stageIndex - b.stageIndex) || (a.x - b.x)
  ))[0] ?? null;
}

export function canWalkDirection(
  snapshot: VisualizationSnapshot | null,
  direction: WalkDirection,
): boolean {
  const frontier = findWalkFrontier(snapshot, direction);
  if (!frontier) return false;

  // Older fixtures may omit availability. Production snapshots always include it.
  const availability = snapshot?.walkAvailability;
  if (!availability) return true;
  return availability[frontier.occurrenceId]?.[direction] === true;
}

function isNavigableOccurrence(occurrence: Occurrence): boolean {
  return occurrence.displayRole !== 'role';
}
