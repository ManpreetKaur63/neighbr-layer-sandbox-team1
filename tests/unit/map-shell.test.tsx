import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapShell } from '@/features/map/MapShell';
import { StubMapPort } from '@/map/stub-map';
import { createMockServices } from '@/services/mock';

let stub: StubMapPort;
const factory = () => stub;

function setup(url = '/map', services = createMockServices()) {
  window.history.replaceState(null, '', url);
  stub = new StubMapPort();
  const user = userEvent.setup();
  render(<MapShell services={services} mapFactory={factory} />);
  return user;
}

beforeEach(() => window.history.replaceState(null, '', '/map'));
afterEach(() => window.history.replaceState(null, '', '/map'));

describe('MapShell with a stub map (the map provider is replaceable)', () => {
  it('mounts the map port and sends it markers and boundaries', async () => {
    setup();
    await screen.findByText(/22 results in Windsor/);
    await waitFor(() => expect(stub.mounted).toBe(true));
    await waitFor(() => expect(stub.markers.length).toBe(22));
    expect(stub.boundaries.features.length).toBe(3);
    expect(stub.view?.center[0]).toBeCloseTo(-83.0);
  });

  it('shows the resident context in the home city', async () => {
    setup();
    expect(await screen.findByText('Resident of Windsor')).toBeInTheDocument();
  });

  it('selecting a list item opens details, flies the map there and keeps the id in the URL', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: /Roadworks affecting shop access/ }));
    expect(await screen.findByRole('heading', { name: 'Roadworks affecting shop access' })).toBeInTheDocument();
    expect(window.location.search).toContain('sel=w-roadworks');
    await waitFor(() => expect(stub.selected).toBe('w-roadworks'));
    expect(stub.flights.at(-1)).toEqual([-82.9765, 42.327]);
    expect(screen.getByText(/Invented demo record/)).toBeInTheDocument();
  });

  it('opens details when the map reports a pin click, and Escape returns to the list', async () => {
    const user = setup();
    await screen.findByText(/22 results/);
    await waitFor(() => expect(stub.markers.length).toBeGreaterThan(0));
    stub.emitSelect('w-streetlight');
    expect(await screen.findByText(/Light replaced by a sample works crew/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('heading', { name: 'Places and activity' })).toBeInTheDocument();
    expect(window.location.search).not.toContain('sel=');
  });

  it('shows a boundary with a trust warning when the map reports a boundary click', async () => {
    setup();
    await screen.findByText(/22 results/);
    await waitFor(() => expect(stub.markers.length).toBeGreaterThan(0));
    stub.emitSelect('boundary:olde-riverside-corridor');
    expect(await screen.findByRole('heading', { name: /Olde Riverside corridor/ })).toBeInTheDocument();
    expect(screen.getByText(/Don't rely on this outline/)).toBeInTheDocument();
  });

  it('filters by kind and clears the filters', async () => {
    const user = setup();
    await screen.findByText(/22 results/);
    await user.click(screen.getByRole('button', { name: 'Polls' }));
    expect(await screen.findByText('2 results in Windsor')).toBeInTheDocument();
    expect(stub.markers.every((m) => m.kind === 'poll')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('22 results in Windsor')).toBeInTheDocument();
  });

  it('switching to the civic lens drops social kinds from the filters', async () => {
    const user = setup();
    await screen.findByText(/22 results/);
    await user.click(screen.getByRole('radio', { name: 'Civic pulse' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Businesses' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Issues' })).toBeInTheDocument();
  });

  it('searches as you type', async () => {
    const user = setup();
    await screen.findByText(/22 results/);
    await user.type(screen.getByRole('searchbox'), 'vacancy');
    expect(await screen.findByText('1 result in Windsor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sample storefront for lease/ })).toBeInTheDocument();
  });

  it('shows a helpful empty state when nothing matches', async () => {
    const user = setup();
    await screen.findByText(/22 results/);
    await user.type(screen.getByRole('searchbox'), 'zzzz');
    expect(await screen.findByText(/Nothing matches those filters/)).toBeInTheDocument();
    // Both the filter row and the empty state offer "Clear filters"; either one resets the view.
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!);
    expect(await screen.findByText(/22 results/)).toBeInTheDocument();
  });

  it('shows an empty state for a city with no demo data', async () => {
    setup('/map?city=miami');
    expect(await screen.findByText(/Nothing on the map in Miami yet/)).toBeInTheDocument();
  });

  it('shows the error state and recovers on retry', async () => {
    const failing = createMockServices({ failObjects: true });
    const ok = createMockServices();
    let calls = 0;
    const flaky = {
      ...ok,
      objects: {
        ...ok.objects,
        list: (q: Parameters<typeof ok.objects.list>[0]) => (calls++ === 0 ? failing.objects.list(q) : ok.objects.list(q)),
      },
    };
    const user = setup('/map', flaky);
    expect(await screen.findByText("The results didn't load")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/22 results in Windsor/)).toBeInTheDocument();
  });

  it('makes you a visitor in another city and restricts resident-only polls', async () => {
    const user = setup();
    await screen.findByText(/22 results/);
    await user.click(screen.getByRole('button', { name: /Windsor, Ontario/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Toronto, Ontario' }));
    expect(await screen.findByText('Visitor from Windsor')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Sample ward poll/ }));
    expect(await screen.findByText('Residents only')).toBeInTheDocument();
    expect(screen.getByText(/Only verified residents of Toronto can take this poll/)).toBeInTheDocument();
    await waitFor(() => expect(stub.view?.center[0]).toBeCloseTo(-79.3832));
  });

  it('lets a resident see the same kind of poll as open to them', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: /Which hours suit a Saturday market/ }));
    expect(await screen.findByText('Open to you')).toBeInTheDocument();
    expect(screen.queryByText('Residents only')).not.toBeInTheDocument();
  });

  it('explains when a typed destination is not in the demo', async () => {
    const user = setup();
    await screen.findByText(/22 results/);
    await user.click(screen.getByRole('button', { name: /Windsor, Ontario/ }));
    await user.type(screen.getByLabelText('City'), 'Atlantis{Enter}');
    expect(await screen.findByText(/isn't in the demo/)).toBeInTheDocument();
  });

  it('restores state from a deep link', async () => {
    setup('/map?lens=civic&kinds=issue&q=sidewalk&sel=w-sidewalk');
    expect(await screen.findByRole('heading', { name: 'Sidewalk repair requested' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Civic pulse' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('searchbox')).toHaveValue('sidewalk');
  });
});
