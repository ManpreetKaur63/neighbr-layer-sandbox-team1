import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/',
}));

import { ReportIssueClient } from '@/app/issues/report/ReportIssueClient';
import { WorkspaceClient } from '@/components/WorkspaceClient';
import { BusinessesClient } from '@/app/businesses/BusinessesClient';
import { NotificationsClient } from '@/app/notifications/NotificationsClient';
import { MapShell } from '@/features/map/MapShell';
import { StubMapPort } from '@/map/stub-map';
import { resetSessionServices } from '@/services/session';

beforeEach(() => {
  resetSessionServices();
  search = '';
  window.history.replaceState(null, '', '/map');
});
afterEach(() => resetSessionServices());

describe('screens share one demo session', () => {
  it('BIA directory lists only corridor businesses and says what it left out', async () => {
    search = 'tab=listings';
    render(<WorkspaceClient kind="bia" />);
    expect(await screen.findByRole('heading', { name: 'Corridor listings' })).toBeInTheDocument();
    for (const name of [/Bakery/, /Hardware/, /Caf/]) expect(await screen.findAllByRole('heading', { name })).not.toHaveLength(0);
    expect(screen.queryByRole('heading', { name: /Books|Pizza/ })).not.toBeInTheDocument();
    expect(screen.getByText(/2 businesses elsewhere in Windsor left out/)).toBeInTheDocument();
  });

  it('public directory can narrow to the corridor', async () => {
    const user = userEvent.setup();
    render(<BusinessesClient />);
    await screen.findAllByRole('article');
    const all = screen.getAllByRole('article').length;
    await user.click(await screen.findByRole('button', { name: /Only inside Olde Riverside/ }));
    await waitFor(() => expect(screen.getAllByRole('article').length).toBeLessThan(all));
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('issue reported on one screen -> BIA acts on another -> outcome on the map and in notifications', async () => {
    const user = userEvent.setup();

    // Screen 1: report.
    render(<ReportIssueClient />);
    await user.type(screen.getByLabelText(/What.s the issue/), 'Broken bench by the bakery');
    await user.click(screen.getByRole('button', { name: 'File report' }));
    expect(await screen.findByText(/Report filed/)).toBeInTheDocument();
    cleanup();

    // Screen 2: BIA sees it under Community signals and takes it on.
    search = 'tab=signals';
    render(<WorkspaceClient kind="bia" />);
    const card = await screen.findByRole('article', { name: /Signal: Broken bench by the bakery/ });
    await user.click(within(card).getByRole('button', { name: 'Take on as a task' }));
    await waitFor(() => expect(screen.getByRole('article', { name: /Signal: Broken bench/ })).toHaveTextContent('Acknowledged'));
    await user.click(within(screen.getByRole('article', { name: /Signal: Broken bench/ })).getByRole('button', { name: 'Start task' }));
    await waitFor(() => expect(screen.getByRole('article', { name: /Signal: Broken bench/ })).toHaveTextContent('In progress'));
    await user.click(within(screen.getByRole('article', { name: /Signal: Broken bench/ })).getByRole('button', { name: 'Mark done' }));
    await waitFor(() => expect(screen.getByRole('article', { name: /Signal: Broken bench/ })).toHaveTextContent('Resolved'));
    cleanup();

    // Screen 3: the reporter's notifications show each step.
    render(<NotificationsClient />);
    expect(await screen.findByText('Your issue was resolved')).toBeInTheDocument();
    expect(screen.getByText('Your report was acknowledged')).toBeInTheDocument();
    cleanup();

    // Screen 4: the map (no injected services) shows the Resolved issue with its published outcome.
    const stub = new StubMapPort();
    const issueId = (await (await import('@/services/session')).getSessionServices().objects.list({ cityId: 'windsor', text: 'Broken bench' }))[0]!.id;
    window.history.replaceState(null, '', `/map?sel=${issueId}`);
    render(<MapShell mapFactory={() => stub} />);
    expect(await screen.findByRole('heading', { name: 'Broken bench by the bakery' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Outcome' })).toHaveTextContent(/Sample Olde Riverside BIA completed/);
    expect(within(screen.getByRole('article')).getAllByText('Resolved').length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: 'Follow-up' })).toBeInTheDocument();
  });

  it('a corridor outline on the map lists the businesses inside it', async () => {
    const stub = new StubMapPort();
    window.history.replaceState(null, '', '/map?sel=boundary:olde-riverside-corridor');
    render(<MapShell mapFactory={() => stub} />);
    const section = await screen.findByRole('region', { name: 'Businesses inside this area' });
    expect(section).toHaveTextContent(/3 businesses inside this outline/);
    expect(within(section).getByRole('link', { name: /Open this BIA.s directory/ })).toHaveAttribute('href', expect.stringContaining('tab=listings'));
  });
});
