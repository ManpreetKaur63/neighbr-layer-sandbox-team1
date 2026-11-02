import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StateBoundary } from '@/components/StateBoundary';

describe('StateBoundary', () => {
  it('renders children on success', () => {
    render(<StateBoundary state="success">content</StateBoundary>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('announces loading politely', () => {
    render(<StateBoundary state="loading" loadingLabel="Loading Windsor…" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading Windsor…')).toBeInTheDocument();
  });

  it('explains errors and offers a retry', async () => {
    const onRetry = vi.fn();
    render(<StateBoundary state="error" errorHelp="Check your connection." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows empty and restricted states with their own wording', () => {
    const { rerender } = render(<StateBoundary state="empty" emptyTitle="Nothing yet" />);
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    rerender(<StateBoundary state="restricted" restrictedTitle="Staff only" />);
    expect(screen.getByText('Staff only')).toBeInTheDocument();
  });
});
