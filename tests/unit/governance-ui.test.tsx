import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspaceClient } from '@/components/WorkspaceClient';
import { ROUTE_KINDS } from '@/lib/workspace-config';
import { appGovStore, createGovStore } from '@/services/mock/governance';
import { setOnboardingRole } from '@/lib/session';

/* Merged tree (Nov 11, 2026): the governance panels live on the 'government' kind at /government, not on
 * 'office'/'department' kinds at /representative. There is no "View as" picker (ADR-017): the workspace
 * acts as the onboarded role, and these tests act as city staff (m-gov-2). Public Works is the only
 * verified department, so it is both the office that logs cases and the department that works them. */

let query = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

function reset() {
  const seed = createGovStore();
  appGovStore.cases.splice(0, appGovStore.cases.length, ...seed.cases);
  appGovStore.communications.splice(0, appGovStore.communications.length, ...seed.communications);
  appGovStore.audit.splice(0, appGovStore.audit.length, ...seed.audit);
  appGovStore.seq = 0;
  query = '';
  window.sessionStorage.clear();
  setOnboardingRole('city-staff');
}

beforeEach(reset);

function renderGov(q: string) {
  query = q;
  return render(<WorkspaceClient kind="government" kinds={ROUTE_KINDS['/government']} />);
}

const PW = 'ws-gov-public-works';
const PARKS = 'ws-gov-parks';

describe('the government dashboard and tabs', () => {
  it('counts cases and waiting work from the records', async () => {
    renderGov(`ws=${PW}`);
    const counts = await screen.findByRole('list', { name: 'Counts' });
    // Merged seeds: waiting = received (1001, 1006) + returned (1005) + routed (1002) = 4;
    // in review = comm-2; published = comm-1 and comm-5.
    expect(within(counts).getByText('Waiting for a next step').previousSibling?.textContent).toBe('4');
    expect(within(counts).getByText('Awaiting approval').previousSibling?.textContent).toBe('1');
    expect(within(counts).getByText('Published').previousSibling?.textContent).toBe('2');
    expect(await screen.findByText('Case pipeline')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Case pipeline' })).toBeInTheDocument();
  });

  it('?tab= opens a tab directly, and an unknown tab falls back to the dashboard', async () => {
    const a = renderGov(`ws=${PW}&tab=audit`);
    expect(await screen.findByRole('region', { name: 'Audit record' })).toBeInTheDocument();
    a.unmount();
    renderGov(`ws=${PW}&tab=nonsense`);
    expect(await screen.findByRole('list', { name: 'Counts' })).toBeInTheDocument();
  });

  it('the route serves the government kind and offers a switch between its two tenants', async () => {
    renderGov(`ws=${PW}`);
    await screen.findByRole('list', { name: 'Counts' });
    const switcher = screen.getByText((_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes('Switch tenant:'));
    expect(within(switcher as HTMLElement).getByText('Sample City of Windsor — Public Works')).toBeInTheDocument();
    expect(within(switcher as HTMLElement).getByRole('link', { name: 'Sample Parks & Recreation' })).toBeInTheDocument();
  });
});

describe('the public view', () => {
  it('lists published items only, and counts what is withheld', async () => {
    renderGov(`ws=${PW}&tab=public`);
    const preview = await screen.findByLabelText('Public preview');
    expect(within(preview).getByText('Ward community meeting, 19 November')).toBeInTheDocument();
    expect(within(preview).getByText('Streetlight repaired on the sample block')).toBeInTheDocument();
    expect(within(preview).queryByText('Winter parking reminder')).not.toBeInTheDocument();
    expect(within(preview).queryByText('Riverside Drive lane closure this week')).not.toBeInTheDocument();
    expect(within(preview).queryByText(/CASE-1006/)).not.toBeInTheDocument();
    const withheld = screen.getByText('Withheld from the public view').parentElement;
    expect(withheld).toHaveTextContent('2 draft');
    expect(withheld).toHaveTextContent('1 in review');
    expect(withheld).toHaveTextContent('6 internal cases');
  });

  it('the phone-width switch narrows the preview', async () => {
    const user = userEvent.setup();
    renderGov(`ws=${PW}&tab=public`);
    const preview = await screen.findByLabelText('Public preview');
    expect(preview).toHaveAttribute('data-width', 'full');
    await user.click(screen.getByRole('button', { name: 'Phone width' }));
    expect(preview).toHaveAttribute('data-width', 'phone');
    expect(screen.getByRole('button', { name: 'Phone width' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('an onboarding department shows no public items and says it cannot publish yet', async () => {
    renderGov(`ws=${PARKS}&tab=public`);
    expect(await screen.findByText('Nothing published yet')).toBeInTheDocument();
    expect(screen.getByText(/not verified, so it cannot publish/)).toBeInTheDocument();
  });
});

describe('cases in the merged model', () => {
  it('routes a case to the verified department and the department accepts it (one shared record)', async () => {
    const user = userEvent.setup();
    renderGov(`ws=${PW}&tab=cases`);
    await user.click(await screen.findByRole('button', { name: /CASE-1006/ }));
    await user.selectOptions(screen.getByLabelText('Route to a department'), PW);
    await user.click(screen.getByRole('button', { name: 'Route case' }));
    expect(await screen.findByText('Case routed. The department can see it now.')).toBeInTheDocument();
    expect(appGovStore.cases.find((c) => c.id === 'case-1006')?.status).toBe('routed');
    await user.click(screen.getByRole('button', { name: 'Accept case' }));
    expect(await screen.findByText('Case accepted.')).toBeInTheDocument();
    expect(appGovStore.cases.find((c) => c.id === 'case-1006')?.status).toBe('in-progress');
    expect(screen.getByRole('list', { name: 'Record of this case' })).toHaveTextContent('Case routed');
    expect(screen.getByRole('list', { name: 'Record of this case' })).toHaveTextContent('Case accepted');
  });

  it('a refused route (onboarding department) shows the reason and lands in the audit record', async () => {
    const user = userEvent.setup();
    renderGov(`ws=${PW}&tab=cases`);
    await user.click(await screen.findByRole('button', { name: /CASE-1001/ }));
    await user.selectOptions(screen.getByLabelText('Route to a department'), PARKS);
    expect(screen.getByText(/You can still try: the service will refuse and record the attempt/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Route case' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Refused');
    expect(alert).toHaveTextContent(/onboarding/);
    expect(alert).toHaveTextContent('written to the audit record');
    expect(appGovStore.cases.find((c) => c.id === 'case-1001')?.status).toBe('received');
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Record of this case' })).toHaveTextContent('Refused:'),
    );
  });

  it('on a phone the list and the case are separate screens with a way back', async () => {
    const user = userEvent.setup();
    const { container } = renderGov(`ws=${PW}&tab=cases`);
    const split = await waitFor(() => {
      const el = container.querySelector('[data-mobile]');
      if (!el) throw new Error('not yet');
      return el;
    });
    expect(split).toHaveAttribute('data-mobile', 'list');
    await user.click(screen.getByRole('button', { name: /CASE-1002/ }));
    const detail = await screen.findByRole('article', { name: 'Case CASE-1002' });
    expect(split).toHaveAttribute('data-mobile', 'detail');
    expect(within(detail).getByText(/Roadworks blocking shop access/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '← All cases' }));
    expect(split).toHaveAttribute('data-mobile', 'list');
  });
});

describe('four-eyes on screen', () => {
  it('staff cannot approve, and the reason is shown', async () => {
    const user = userEvent.setup();
    renderGov(`ws=${PW}&tab=communications`);
    const item = await screen.findByRole('article', { name: 'Riverside Drive lane closure this week' });
    expect(within(item).getByRole('button', { name: 'Approve and publish' })).toBeDisabled();
    expect(within(item).getAllByText(/Only the office lead or department manager/).length).toBeGreaterThan(0);

    // The same holds for the staff member's own draft: staff cannot approve at all.
    await user.click(screen.getByText('Write a draft notice'));
    await user.type(screen.getByLabelText('Draft title'), 'Own notice');
    await user.type(screen.getByLabelText('Draft text'), 'Invented text.');
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    const own = await screen.findByRole('article', { name: 'Own notice' });
    await user.click(within(own).getByRole('button', { name: 'Submit for review' }));
    expect(await within(own).findByRole('button', { name: 'Approve and publish' })).toBeDisabled();
    expect(within(own).getAllByText(/Only the office lead or department manager/).length).toBeGreaterThan(0);
  });
});

describe('the audit tab and case tasks', () => {
  it('shows entries newest first with a refused filter, and a CSV button', async () => {
    const user = userEvent.setup();
    renderGov(`ws=${PW}&tab=audit`);
    const list = await screen.findByRole('list', { name: 'Audit entries' });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(5);
    await user.click(screen.getByRole('button', { name: /^Refused \(/ }));
    const refused = within(screen.getByRole('list', { name: 'Audit entries' })).getAllByRole('listitem');
    expect(refused.length).toBe(1);
    expect(refused[0]).toHaveTextContent('✕ Refused');
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
  });

  it('the Tasks tab lists case tasks derived from the cases', async () => {
    const user = userEvent.setup();
    renderGov(`ws=${PW}&tab=tasks`);
    const tasks = await screen.findByRole('region', { name: 'Case tasks' });
    const row = within(tasks).getByText(/Accept CASE-1002/).closest('li')!;
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Open the case' }));
    expect(await screen.findByRole('article', { name: 'Case CASE-1002' })).toBeInTheDocument();
  });
});
