import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { WalkControls } from './WalkControls';

describe('WalkControls', () => {
  afterEach(() => {
    cleanup();
  });

  test('disables unavailable directions and reports an empty directional walk', () => {
    render(
      <WalkControls
        onWalkLeft={vi.fn()}
        onWalkRight={vi.fn()}
        canWalkLeft={false}
        canWalkRight={false}
        isWalking={false}
        emptyWalkDirection="forward"
        hops={3}
        minHops={1}
        maxHops={10}
        onHopsChange={vi.fn()}
        includeTruncatedPaths={false}
        hiddenTruncatedPathCount={0}
        onIncludeTruncatedPathsChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Walk Left' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Walk Right' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('No further nodes in this direction');
  });
});
