import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const evidence = (name: string) => `docs/evidence/m03/${name}.png`;

async function openMap(page: Page, query = '') {
  await page.goto(`/map${query}`);
  await expect(page.getByRole('heading', { name: 'Places and activity' })).toBeVisible();
}

test('map loads with pins, areas and results', async ({ page }) => {
  await openMap(page);
  await expect(page.getByText(/\d+ results in Windsor/)).toBeVisible();
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
  await page.getByText(/^Areas \(\d+\)$/).click();
  await expect(page.getByRole('button', { name: /Olde Riverside corridor/ })).toBeVisible();
  await expect(page.getByText('Resident of Windsor')).toBeVisible();
});

test('filters and search narrow the list, and the URL keeps the state', async ({ page }) => {
  await openMap(page);
  const countBefore = await page.getByText(/\d+ results in Windsor/).innerText();
  await page.getByRole('button', { name: 'Issues' }).click();
  await expect(page).toHaveURL(/kinds=issue/);
  await expect(page.getByText(/\d+ results in Windsor/)).not.toHaveText(countBefore);
  await page.getByRole('searchbox').fill('roadworks');
  await expect(page.getByRole('button', { name: /Roadworks affecting shop access/ })).toBeVisible();
  await expect(page.getByText('1 result in Windsor')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('searchbox')).toHaveValue('roadworks');
  await expect(page.getByRole('button', { name: 'Issues' })).toHaveAttribute('aria-pressed', 'true');
});

test('selecting a result opens details and Escape returns to the list', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: /Streetlight out on sample block/ }).click();
  await expect(page.getByRole('heading', { name: 'Streetlight out on sample block' })).toBeVisible();
  await expect(page.getByText('Light replaced by a sample works crew')).toBeVisible();
  await expect(page.getByText('Invented demo record')).toBeVisible();
  await page.screenshot({ path: evidence('detail-desktop') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Places and activity' })).toBeVisible();
});

test('switching city makes you a visitor and restricts polls', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: /Windsor, Ontario/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Toronto, Ontario' }).click();
  await expect(page.getByText('Visitor from Windsor')).toBeVisible();
  await expect(page.getByText(/\d+ results in Toronto/)).toBeVisible();
  await page.getByRole('button', { name: /Sample ward poll/ }).click();
  await expect(page.getByText('Residents only')).toBeVisible();
  await expect(page.getByText(/Only verified residents of Toronto can take this poll/)).toBeVisible();
});

test('a city with no demo data shows the empty state', async ({ page }) => {
  await openMap(page, '?city=miami');
  await expect(page.getByText(/Nothing on the map in Miami yet/)).toBeVisible();
});

test('demo switches show loading and error states', async ({ page }) => {
  await openMap(page, '?demo=error');
  await expect(page.locator('[data-state="error"]')).toContainText("The results didn't load");
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('boundary selection explains it is not official', async ({ page }) => {
  await openMap(page);
  await page.getByText(/^Areas \(\d+\)$/).click();
  await page.getByRole('button', { name: /Olde Riverside corridor/ }).click();
  await expect(page.getByRole('heading', { name: /Olde Riverside corridor/ })).toBeVisible();
  await expect(page.getByText("Don't rely on this outline")).toBeVisible();
});

test('every required route responds', async ({ page }) => {
  for (const path of ['/', '/map', '/pulse', '/polls/create', '/issues/report', '/bia', '/admin/audit', '/accessibility', '/status']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
  }
});

test('no serious accessibility violations on the map', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: /Roadworks affecting shop access/ }).click();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
});

for (const [name, size] of [
  ['mobile', { width: 390, height: 844 }],
  ['tablet', { width: 820, height: 1180 }],
  ['desktop', { width: 1440, height: 900 }],
] as const) {
  test(`screenshot ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openMap(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: evidence(`map-${name}`) });
    // No horizontal page scroll at any width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}

test('phone: the map keeps most of the screen, with search, results and navigation in reach', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/map'); // the results heading is hidden while the sheet is peeking, so wait for search instead
  await expect(page.getByRole('searchbox')).toBeVisible();
  const mapBox = await page.getByRole('region', { name: /Interactive map/ }).boundingBox();
  const sheet = await page.getByRole('complementary').boundingBox();
  const search = await page.getByRole('searchbox').boundingBox();
  const dock = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
  expect(mapBox && sheet && search && dock).toBeTruthy();
  // At rest the sheet is a slim bar: the clear map (between the search bar and the sheet) is most of the screen.
  expect(sheet!.y).toBeGreaterThan(844 * 0.7);
  expect(search!.y + search!.height).toBeLessThan(90);
  expect(dock!.y + dock!.height).toBeLessThanOrEqual(844);
  // Results are one tap away, and navigation stays visible.
  await page.getByRole('button', { name: 'Show list' }).click();
  await expect(page.getByRole('heading', { name: 'Places and activity' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Civic pulse' })).toBeVisible();
});

test('journey: report an issue, the BIA acts on it, the outcome shows on the map', async ({ page }) => {
  await page.goto('/issues/report');
  await page.getByLabel(/What.s the issue/).fill('Broken bench by the bakery');
  await page.getByRole('button', { name: 'File report' }).click();
  await page.getByRole('link', { name: 'Open the BIA workspace' }).click();
  const card = page.getByRole('article', { name: /Signal: Broken bench by the bakery/ });
  await card.getByRole('button', { name: 'Take on as a task' }).click();
  await card.getByRole('button', { name: 'Start task' }).click();
  await card.getByRole('button', { name: 'Mark done' }).click();
  await expect(card).toContainText('Resolved');
  await card.getByRole('link', { name: /View on map/ }).click();
  await expect(page.getByRole('heading', { name: 'Broken bench by the bakery' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Outcome' })).toContainText('Sample Olde Riverside BIA completed');
});
