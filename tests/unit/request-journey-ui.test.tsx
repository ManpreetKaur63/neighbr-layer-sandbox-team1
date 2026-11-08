import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarketplaceClient } from '@/app/marketplace/MarketplaceClient';
import { MessagesClient } from '@/app/messages/MessagesClient';
import { ReportIssueClient } from '@/app/issues/report/ReportIssueClient';
import { WorkspaceClient } from '@/components/WorkspaceClient';
import { RequestQueue } from '@/components/RequestQueue';
import { createMockServices } from '@/services/mock';
import { appRequestStore, createRequestStore } from '@/services/mock/requests';

let query = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

/** The running app shares one store between pages; the journey tests reset it, as a reload would. */
function reset() {
  appRequestStore.requests.length = 0;
  appRequestStore.issueObjects.length = 0;
  appRequestStore.readEventIds.clear();
  appRequestStore.seq = 0;
  query = '';
}

beforeEach(reset);

describe('the request journey across screens (M06)', () => {
  it('Marketplace: shows only the published offer, never an address, and sends a request', async () => {
    const user = userEvent.setup();
    render(<MarketplaceClient />);
    expect(await screen.findByText('Weekend bread bundle')).toBeInTheDocument();
    expect(screen.queryByText('Garden weekend starter kit')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Request address' }));
    expect(await screen.findByText(/Request sent · Submitted/)).toBeInTheDocument();
    expect(appRequestStore.requests).toHaveLength(1);
    expect(appRequestStore.requests[0]?.workspaceId).toBe('ws-biz-bakery');
  });

  it('follows one request: the business resolves it in its workspace, the person reads it and follows up', async () => {
    const user = userEvent.setup();

    // 1. The person asks for an address in the Marketplace.
    const market = render(<MarketplaceClient />);
    await user.click(await screen.findByRole('button', { name: 'Request address' }));
    await screen.findByText(/Request sent/);
    market.unmount();

    // 2. The business owner sees it in the work queue and resolves it.
    query = 'ws=ws-biz-bakery';
    const ws = render(<WorkspaceClient kind="business" />);
    await user.click(await screen.findByRole('button', { name: 'Requests' }));
    expect(await screen.findByText(/Address for Weekend bread bundle/, { selector: 'h2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start review' }));
    await screen.findByText('Review started.');
    await user.type(screen.getByLabelText(/Note to the person/), 'Demo address shared (invented).');
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(await screen.findByText('Request resolved.')).toBeInTheDocument();
    ws.unmount();

    // 3. The person reads the response in Messages and follows up.
    query = `id=${appRequestStore.requests[0]?.id}`;
    render(<MessagesClient />);
    expect(await screen.findByText(/The team marked this resolved/)).toBeInTheDocument();
    expect(screen.getByText('Resolved: Demo address shared (invented).')).toBeInTheDocument();
    await user.type(screen.getByLabelText('What is still wrong?'), 'The address did not arrive.');
    await user.click(screen.getByRole('button', { name: 'Follow up' }));
    expect(await screen.findByText(/Follow-up sent/)).toBeInTheDocument();
    expect(appRequestStore.requests[0]?.status).toBe('in-review');
  });

  it('report form: sends the issue to the BIA queue and links to the request in Messages', async () => {
    const user = userEvent.setup();
    render(<ReportIssueClient />);
    await user.type(screen.getByLabelText(/What.s the issue/), 'Broken bench on Riverside');
    await user.click(screen.getByRole('button', { name: 'File report' }));
    expect(await screen.findByText(/sent to the Olde Riverside BIA work queue/)).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Messages' });
    expect(links.some((a) => /^\/messages\?id=req-/.test(a.getAttribute('href') ?? ''))).toBe(true);
    expect(appRequestStore.requests[0]?.workspaceId).toBe('ws-bia-sample');
  });

  it('Messages: an empty inbox says what to do next', async () => {
    render(<MessagesClient />);
    expect(await screen.findByText('No requests yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report an issue' })).toBeInTheDocument();
  });

  it('a view-only member sees the queue but every control is disabled, with the reason', async () => {
    const store = createRequestStore();
    const services = createMockServices({ requestStore: store });
    await services.requests.create({ kind: 'issue', title: 'Light out', summary: '', cityId: 'windsor' });
    const requests = await services.requests.list({ workspaceId: 'ws-bia-sample' });
    const workspace = (await services.workspaces.workspace('ws-bia-sample'))!;
    const members = await services.workspaces.members('ws-bia-sample');
    render(
      <RequestQueue
        requests={requests}
        workspace={workspace}
        roleLabels={{ owner: 'Owner', staff: 'Staff', member: 'Member' }}
        members={members}
        actor={{ name: 'Demo viewer', role: 'member', memberStatus: 'active' }}
        services={services}
        onChanged={() => undefined}
      />,
    );
    expect(await screen.findByText(/Not available for this person: The member role cannot work/)).toBeInTheDocument();
    for (const name of ['Start review', 'Ask for more information', 'Decline', 'Resolve', 'Send message']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled());
  });
});
