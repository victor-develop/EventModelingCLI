import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DraftControls } from './DraftControls';

describe('DraftControls', () => {
  test('shows the active draft when the URL request uses draft=active', () => {
    const onNavigate = vi.fn();
    render(
      <DraftControls
        draftsData={{
          activeDraftId: 'draft_002',
          drafts: [
            {
              id: 'draft_001',
              status: 'submitted',
              baseRevisionId: 'rev_000',
              message: 'Initial submitted draft',
              isActive: false,
              summary: { totalChanges: 78 },
            },
            {
              id: 'draft_002',
              status: 'open',
              baseRevisionId: 'rev_001',
              message: 'Draft return label flow',
              isActive: true,
              summary: { totalChanges: 15 },
            },
          ],
        }}
        request={{
          focus: 'ui.screen.return-request-form',
          direction: 'forward',
          hops: 4,
          includeTruncatedPaths: false,
          draft: 'active',
          graph: 'compare',
          diff: 'overlay',
        }}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByLabelText('Draft')).toHaveValue('draft_002');
    expect(screen.queryByRole('option', { name: 'draft_001 · submitted' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'base' }));

    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({
      draft: 'active',
      graph: 'base',
      diff: 'overlay',
    }), 'push');
  });
});
