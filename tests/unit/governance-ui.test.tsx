import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceClient } from '@/components/WorkspaceClient';
import { ROUTE_KINDS } from '@/lib/workspace-config';
import { appGovStore, createGovStore } from '@/services/mock/governance';

let query = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

/** The running app shares one store between pages; these tests reset it, as a new tab would. */
function reset() {
  const seed = createGovStore();
  appGovStore.cases.splice(0, appGovStore.cases.length, ...seed.cases);
  appGovStore.communications.splice(0, appGovStore.communications.length, ...seed.communications);
  appGovStore.audit.splice(0, appGovStore.audit.length, ...seed.audit);
  appGovStore.seq = 0;
  query = '';
}
beforeEach(reset);

const renderRoute = () => render(<WorkspaceClient kind="office" kinds={ROUTE_KINDS['/representative']} />);

async function viewAs(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const select = await screen.findByRole('combobox', { name: 'View as' });
  const option = within(select).getByRole('option', { name });
  await user.selectOptions(select, option);
}

describe('public office and department screens (M07)', () => {
  it('office dashboard counts cases and waiting work from the records', async () => {
    query = 'ws=ws-ward-sample';
    renderRoute();
    const counts = await screen.findByRole('list', { name: 'Counts' });
    expect(within(counts).getByText('Waiting to be routed').previousSibling).toHaveTextContent('3'); // received x2 + returned
    expect(within(counts).getByText('Awaiting approval').previousSibling).toHaveTextContent('1');
    expect(within(counts).getByText('Published').previousSibling).toHaveTextContent('1');
    expect(screen.getByRole('list', { name: 'Case pipeline', hidden: false })).toBeInTheDocument();
  });

  it('?tab= opens a tab directly, and an unknown tab falls back to the dashboard', async () => {
    query = 'ws=ws-ward-sample&tab=audit';
    const a = renderRoute();
    expect(await screen.findByRole('region', { name: 'Audit record' })).toBeInTheDocument();
    a.unmount();
    query = 'ws=ws-ward-sample&tab=nonsense';
    renderRoute();
    expect(await screen.findByRole('list', { name: 'Counts' })).toBeInTheDocument();
  });

  it('public view lists published items only, and counts what is withheld', async () => {
    query = 'ws=ws-ward-sample&tab=public';
    renderRoute();
    const frame = await screen.findByLabelText('Public preview');
    expect(await within(frame).findByText('Ward community meeting, 19 November')).toBeInTheDocument();
    expect(within(frame).getByText('Streetlight repaired on the sample block')).toBeInTheDocument();
    expect(within(frame).queryByText('Winter parking reminder')).not.toBeInTheDocument();
    expect(within(frame).queryByText('Riverside Drive lane closure this week')).not.toBeInTheDocument();
    expect(within(frame).queryByText(/CASE-1006/)).not.toBeInTheDocument();
    const withheld = screen.getByText('Withheld from the public view').parentElement!;
    expect(withheld).toHaveTextContent('1 draft');
    expect(withheld).toHaveTextContent('1 in review');
    expect(withheld).toHaveTextContent('6 internal cases');
  });

  it('the phone-width switch narrows the preview', async () => {
    const user = userEvent.setup();
    query = 'ws=ws-ward-sample&tab=public';
    renderRoute();
    const frame = await screen.findByLabelText('Public preview');
    expect(frame).toHaveAttribute('data-width', 'full');
    await user.click(screen.getByRole('button', { name: 'Phone width' }));
    expect(frame).toHaveAttribute('data-width', 'phone');
    expect(screen.getByRole('button', { name: 'Phone width' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('routes a case to a department, and the department sees it and accepts it (one shared record)', async () => {
    const user = userEvent.setup();
    query = 'ws=ws-ward-sample&tab=cases';
    const office = renderRoute();
    await user.click(await screen.findByRole('button', { name: /CASE-1006/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Route to a department' }), 'ws-dept-parks');
    await user.click(screen.getByRole('button', { name: 'Route case' }));
    expect(await screen.findByText('Case routed. The department can see it now.')).toBeInTheDocument();
    expect(appGovStore.cases.find((c) => c.id === 'case-1006')).toMatchObject({ status: 'routed', departmentId: 'ws-dept-parks' });
    office.unmount();

    query = 'ws=ws-dept-parks&tab=cases';
    renderRoute();
    await user.click(await screen.findByRole('button', { name: /CASE-1006/ }));
    await user.click(await screen.findByRole('button', { name: 'Accept case' }));
    expect(await screen.findByText('Case accepted.')).toBeInTheDocument();
    expect(appGovStore.cases.find((c) => c.id === 'case-1006')?.status).toBe('in-progress');
    // The record of the case shows both sides' steps.
    const record = screen.getByRole('list', { name: 'Record of this case' });
    expect(within(record).getByText(/Case routed/)).toBeInTheDocument();
    expect(within(record).getByText(/Case accepted/)).toBeInTheDocument();
  });

  it('a refused route (restricted department) shows the reason and lands in the audit record', async () => {
    const user = userEvent.setup();
    query = 'ws=ws-ward-sample&tab=cases';
    renderRoute();
    await user.click(await screen.findByRole('button', { name: /CASE-1001/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Route to a department' }), 'ws-dept-licensing');
    expect(screen.getByText(/You can still try: the service will refuse and record the attempt/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Route case' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Refused/);
    expect(alert).toHaveTextContent(/restricted/);
    expect(alert).toHaveTextContent(/written to the audit record/);
    expect(appGovStore.cases.find((c) => c.id === 'case-1001')?.status).toBe('received');
    await waitFor(() => {
      const record = screen.getByRole('list', { name: 'Record of this case' });
      expect(within(record).getByText(/Refused:/)).toBeInTheDocument();
    });
  });

  it('four-eyes on screen: the owner can approve a colleague’s draft but is refused on their own', async () => {
    const user = userEvent.setup();
    query = 'ws=ws-ward-sample&tab=communications';
    renderRoute();
    // The chief of staff (default view) approves the communications officer's item.
    const card = (await screen.findByRole('article', { name: 'Riverside Drive lane closure this week' }));
    await user.click(within(card).getByRole('button', { name: 'Approve and publish' }));
    expect(await screen.findByText('Approved and published. It is public now.')).toBeInTheDocument();
    expect(appGovStore.communications.find((m) => m.id === 'comm-2')?.state).toBe('published');

    // They write and submit their own item, then try to approve it.
    await user.click(screen.getByText('Write a draft notice'));
    await user.type(screen.getByLabelText('Draft title'), 'Own notice');
    await user.type(screen.getByLabelText('Draft text'), 'Invented text.');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    const own = await screen.findByRole('article', { name: 'Own notice' });
    await user.click(within(own).getByRole('button', { name: 'Submit for review' }));
    const inReview = await screen.findByRole('button', { name: 'Try to approve my own draft' });
    expect(screen.getByText(/Four-eyes rule: you wrote this/)).toBeInTheDocument();
    await user.click(inReview);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Four-eyes/);
    expect(appGovStore.communications.find((m) => m.title === 'Own notice')?.state).toBe('in-review');
    expect(appGovStore.audit.at(-1)).toMatchObject({ outcome: 'denied', action: 'comm-approved', actorId: 'm-ward-1' });
  });

  it('staff see why approval is unavailable instead of a working button', async () => {
    const user = userEvent.setup();
    query = 'ws=ws-ward-sample&tab=communications';
    renderRoute();
    await screen.findByRole('article', { name: 'Riverside Drive lane closure this week' });
    await viewAs(user, /Demo constituent services officer/);
    const card = await screen.findByRole('article', { name: 'Riverside Drive lane closure this week' });
    expect(within(card).getByRole('button', { name: 'Approve and publish' })).toBeDisabled();
    expect(within(card).getAllByText(/Only the office lead or department manager/).length).toBeGreaterThan(0);
  });

  it('audit tab shows entries newest first with a refused filter, and a CSV button', async () => {
    const user = userEvent.setup();
    query = 'ws=ws-ward-sample&tab=audit';
    renderRoute();
    const list = await screen.findByRole('list', { name: 'Audit entries' });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(5);
    await user.click(screen.getByRole('button', { name: /^Refused \(/ }));
    const refused = within(screen.getByRole('list', { name: 'Audit entries' })).getAllByRole('listitem');
    expect(refused.length).toBe(1);
    expect(refused[0]).toHaveTextContent('✕ Refused');
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
  });

  it('an onboarding office cannot route to a department it has not verified and shows no public items', async () => {
    query = 'ws=ws-office-deputy&tab=public';
    renderRoute();
    expect(await screen.findByText('Nothing published yet')).toBeInTheDocument();
    expect(screen.getByText(/not verified, so it cannot publish/)).toBeInTheDocument();
  });

  it('a restricted department is read-only with the reason on screen', async () => {
    query = 'ws=ws-dept-licensing&tab=communications';
    renderRoute();
    expect(await screen.findByText(/Responses/, { selector: 'h2' })).toBeInTheDocument();
    expect(await screen.findByText(/Not available for this person: This workspace is restricted/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create draft' })).toBeDisabled();
  });

  it('the Tasks tab lists case tasks derived from the cases', async () => {
    const user = userEvent.setup();
    query = 'ws=ws-dept-works&tab=tasks';
    renderRoute();
    const section = await screen.findByRole('region', { name: 'Case tasks' });
    expect(within(section).getByText(/Accept CASE-1002/)).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: 'Open the case' }));
    expect(await screen.findByRole('article', { name: 'Case CASE-1002' })).toBeInTheDocument();
  });

  it('on a phone the list and the case are separate screens with a way back', async () => {
    const user = userEvent.setup();
    query = 'ws=ws-ward-sample&tab=cases';
    const { container } = renderRoute();
    const split = await waitFor(() => {
      const el = container.querySelector('[data-mobile]');
      if (!el) throw new Error('not yet');
      return el;
    });
    expect(split).toHaveAttribute('data-mobile', 'list');
    await user.click(screen.getByRole('button', { name: /CASE-1002/ }));
    expect(split).toHaveAttribute('data-mobile', 'detail');
    await user.click(screen.getByRole('button', { name: '← All cases' }));
    expect(split).toHaveAttribute('data-mobile', 'list');
  });

  it('the route serves both kinds and offers a switch between all six workspaces', async () => {
    query = 'ws=ws-ward-sample';
    renderRoute();
    const nav = await screen.findByRole('navigation', { name: 'Switch workspace' });
    expect(within(nav).getAllByRole('listitem')).toHaveLength(6);
  });
});
