/**
 * Records the Week 7 demo: the government department journey (resident →
 * Public Works → resident) plus the local database for onboarding (signup
 * saves the account, sign-in finds it again, profile and Settings show it).
 *
 * Run with the production server up: `npm start -- -p 3100`
 *   node docs/evidence/m07/record-week7-demo.mjs
 *
 * Frames land in docs/evidence/m07/shots/frame-NN.png (1280x800, caption
 * bar burned in at the bottom). Assemble with:
 *   ffmpeg -framerate 1/5 -i frame-%02d.png -c:v libx264 -pix_fmt yuv420p -r 30 Week7_Demo.mp4
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:3100';
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(SHOTS, { recursive: true });

async function setCaption(page, text) {
  await page.evaluate((text) => {
    let el = document.getElementById('__cap');
    if (!el) {
      el = document.createElement('div');
      el.id = '__cap';
      el.style.cssText =
        'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#0a3a2d;color:#fff;font:600 17px/1.35 system-ui,sans-serif;padding:12px 20px;box-shadow:0 -2px 12px rgba(0,0,0,.35)';
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
  }, text);
}

let n = 0;
async function shot(page, caption) {
  n += 1;
  const name = `frame-${String(n).padStart(2, '0')}.png`;
  await setCaption(page, caption);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(SHOTS, name) });
  console.log(name, '·', caption);
}

async function go(page, url, text) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (text) await page.getByText(text).first().waitFor({ timeout: 15000 });
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
  // 1. Resident reports a pothole and chooses who handles it (M07).
  await go(page, '/issues/report', 'Report an issue');
  await page.locator('#t').fill('Pothole on Riverside Drive East');
  await page.locator('#s').fill('Deep pothole in the eastbound lane, near the bakery.');
  await page.locator('#h').selectOption({ label: 'City of Windsor — Public Works' });
  await shot(page, 'Step 1 · A resident reports a pothole — and chooses who should handle it: Public Works');
  await page.getByRole('button', { name: 'File report' }).click();
  await page.getByText('Report filed (demo)').waitFor({ timeout: 15000 });
  await shot(page, 'The report is on the map as Open — and sent to the Public Works work queue');

  // 2. The resident follows it in Messages.
  await page.getByRole('link', { name: /Messages/ }).first().click();
  await page.getByText('Submitted').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /Pothole on Riverside Drive East/ }).first().click();
  await page.waitForTimeout(600);
  await shot(page, 'Messages: Submitted, handled by Public Works, with the record of what happened');

  // 3. Sign up as City staff — the role step (M07) and the local database.
  await go(page, '/signup', 'Sign up');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Your name').fill('Demo Staff');
  await page.getByLabel('Email').fill('staff@example.com');
  await page.getByLabel(/Password/).fill('password123');
  await page.getByRole('button', { name: 'Choose your role' }).click();
  await page.getByRole('button', { name: /City staff/ }).click();
  await shot(page, 'Step 2 · Sign up: the role is chosen here, at signup — City staff');
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Create demo account' }).click();
  await page.getByText('Onboarding complete (demo)').waitFor({ timeout: 15000 });
  await shot(page, 'The account is saved in the local database on this device — the password is never stored');

  // 4. The department workspace (M07).
  await go(page, '/government', 'Sample City of Windsor');
  await shot(page, 'Step 3 · The government workspace: Public Works, with the request needing attention');
  await page.getByRole('button', { name: 'Requests', exact: true }).first().click();
  await page.waitForTimeout(600);
  await shot(page, 'The Requests tab is the work queue — the pothole is waiting there');
  await page.getByRole('button', { name: /Pothole on Riverside Drive East/ }).first().click();
  await page.waitForTimeout(600);
  await page.getByLabel('Assign to').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Assign', exact: true }).click();
  await page.waitForTimeout(600);
  // Assigning a submitted request starts the review (the port moves it to
  // in-review), so there is no separate Start review step here.
  await page.getByLabel('Send a message').fill('Crew scheduled for Thursday.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await page.waitForTimeout(600);
  await shot(page, 'Assigned to a named staff member, in review — and an update sent to the resident');
  await page.getByLabel(/Note to the person/).fill('Pothole filled.');
  await page.getByRole('button', { name: 'Resolve', exact: true }).click();
  await page.waitForTimeout(600);
  await shot(page, 'Resolved — the outcome is written to the record, and the resident can see it');

  // 5. Back on the resident's side: the request is resolved.
  await go(page, '/messages', 'Messages');
  await page.getByRole('button', { name: /Pothole on Riverside Drive East/ }).first().click();
  await page.waitForTimeout(600);
  await shot(page, 'The resident reads the outcome — and can follow up if the problem comes back');

  // 6. The local database: a new session, same device — sign in finds the account.
  await page.evaluate(() => sessionStorage.clear());
  await go(page, '/signin', 'Sign in');
  await page.getByLabel('Email').fill('staff@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in (demo)' }).click();
  await page.getByText('Signed in (demo)').waitFor({ timeout: 15000 });
  await shot(page, 'Step 4 · A new session, same device: sign-in finds the saved account and applies its role');

  // 7. Profile shows the saved account; Settings shows the role and the stored data.
  await go(page, '/profile', 'Profile');
  await shot(page, 'Profile: the saved account, from the local database — not the fixed demo profile');
  await go(page, '/settings', 'Settings');
  await shot(page, 'Settings: the role, and the demo data stored on this device — with a way to clear it all');

  console.log(`Done: ${n} frames in ${SHOTS}`);
} finally {
  await browser.close();
}
