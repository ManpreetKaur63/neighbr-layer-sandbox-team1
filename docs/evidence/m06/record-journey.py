import re, sys, json
from playwright.sync_api import sync_playwright, expect

BASE = 'http://localhost:3100'
SHOTS = '/home/claude/evidence/screens'
log = []

CAPTION_JS = """
(text) => {
  try { sessionStorage.setItem('__cap', text); } catch (e) {}
  let el = document.getElementById('__cap');
  if (!el) { el = document.createElement('div'); el.id='__cap';
    el.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#0a3a2d;color:#fff;font:600 17px/1.35 system-ui,sans-serif;padding:12px 20px;box-shadow:0 -2px 12px rgba(0,0,0,.35)';
    document.documentElement.appendChild(el); }
  el.textContent = text;
}"""
INIT = """
addEventListener('DOMContentLoaded', () => { try { const t = sessionStorage.getItem('__cap'); if (t) {
  const el=document.createElement('div'); el.id='__cap';
  el.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#0a3a2d;color:#fff;font:600 17px/1.35 system-ui,sans-serif;padding:12px 20px;box-shadow:0 -2px 12px rgba(0,0,0,.35)';
  el.textContent=t; document.documentElement.appendChild(el);} } catch(e){} });
"""

def run(record):
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        kw = dict(viewport={'width':1280,'height':800})
        if record: kw.update(record_video_dir='/home/claude/evidence/video_raw', record_video_size={'width':1280,'height':800})
        ctx = b.new_context(**kw)
        ctx.add_init_script(INIT)
        pg = ctx.new_page()

        def cap(t, pause=1300):
            pg.evaluate(CAPTION_JS, t); pg.wait_for_timeout(pause)
        def shot(name):
            pg.screenshot(path=f'{SHOTS}/{name}.png'); log.append(name)
        def go(path, wait_text=None):
            pg.goto(BASE + path, wait_until='networkidle'); pg.wait_for_timeout(500)
            if wait_text: expect(pg.get_by_text(wait_text).first).to_be_visible(timeout=15000)
        def tab(name):
            pg.get_by_role('button', name=name, exact=True).first.click(); pg.wait_for_timeout(400)
        def view_as(label_part):
            sel = pg.get_by_label('View as')
            val = sel.locator('option', has_text=label_part).first.get_attribute('value')
            sel.select_option(val); pg.wait_for_timeout(400)
        def open_request(title):
            pg.get_by_role('button', name=re.compile(re.escape(title))).first.click(); pg.wait_for_timeout(500)

        # 0. The BIA directory is limited to its boundary
        go('/bia', 'Corridor directory')
        pg.evaluate("sessionStorage.removeItem('__cap')")
        cap('Check 1 · The BIA directory shows only businesses inside its boundary (4 of the 8 in Windsor)')
        shot('01-bia-overview-boundary-count')
        tab('Listings')
        cap('Listings tab: the downtown bookshop, pizzeria, gallery and trail lookout are outside the corridor, so they are not listed')
        shot('02-bia-listings-inside-boundary')

        # 1. Resident reports
        go('/issues/report', 'Report an issue')
        cap('Step 1 · A resident reports a broken bench on Wyandotte Street East (inside the Olde Riverside corridor)')
        pg.locator("#t").fill('Broken bench on Riverside')
        pg.get_by_label('Details').fill('Two slats are loose near the bakery. Someone could get hurt.')
        shot('03-report-form-with-location')
        pg.get_by_role('button', name='File report').click()
        expect(pg.get_by_text('Report filed')).to_be_visible(timeout=10000)
        cap('The issue is on the map and was sent to the Olde Riverside BIA work queue')
        shot('04-report-filed-sent-to-bia')
        href = pg.locator('main a[href*="/messages?id="]').first.get_attribute('href')
        req_id = re.search(r'id=([^&]+)', href).group(1)
        log.append(f'request id {req_id}')

        # 2. Resident sees status
        pg.locator('main a[href*="/messages?id="]').first.click(); pg.wait_for_url('**/messages**'); pg.wait_for_timeout(700)
        cap('Step 2 · The resident sees the status (Submitted), who handles it, and who can view or change it')
        shot('05-resident-messages-submitted')

        # 3. BIA chair - full page load, proves the report survived
        go('/bia', 'Corridor directory')
        tab('Requests'); 
        cap('Step 3 · The BIA chair opens the work queue (a full page load: the report is still there)')
        open_request('Broken bench on Riverside')
        shot('06-bia-requests-queue-new-report')
        sel = pg.get_by_label('Assign to'); sel.select_option(label=re.compile('corridor coordinator')) if False else None
        opt = sel.locator('option', has_text='corridor coordinator').first.get_attribute('value'); sel.select_option(opt)
        pg.get_by_role('button', name='Assign', exact=True).click(); pg.wait_for_timeout(500)
        cap('Step 4 · The chair assigns it to the coordinator: status moves to In review')
        shot('07-bia-assigned-in-review')

        # 4. Coordinator asks for info
        view_as('corridor coordinator')
        open_request('Broken bench on Riverside')
        pg.get_by_label(re.compile('Note to the person')).fill('Which side of the street is the bench on?')
        pg.get_by_role('button', name='Ask for more information').click(); pg.wait_for_timeout(600)
        cap('Step 5 · The coordinator asks: Which side of the street? Status: Needs more information')
        shot('08-bia-asks-for-information')

        # 5. Resident replies
        go(f'/messages?id={req_id}', 'Which side of the street')
        cap('Step 6 · The resident reads the question in Messages and answers it')
        pg.get_by_label('Your answer to the team').fill('The north side, outside the bakery.')
        shot('09-resident-sees-question')
        pg.get_by_role('button', name='Send reply').click(); pg.wait_for_timeout(600)
        cap('Status goes back to In review; the record shows Information provided')
        shot('10-resident-replied-in-review')

        # 6. Coordinator resolves
        go('/bia', 'Corridor directory'); tab('Requests'); view_as('corridor coordinator')
        open_request('Broken bench on Riverside')
        pg.get_by_label(re.compile('Note to the person')).fill('Bench repaired')
        pg.get_by_role('button', name='Resolve', exact=True).click(); pg.wait_for_timeout(600)
        cap('Step 7 · The coordinator resolves it: "Bench repaired"')
        shot('11-bia-resolved')

        # 7. Visible outcome
        go(f'/messages?id={req_id}', 'Bench repaired')
        cap('Step 8 · Visible outcome 1: the resident sees Resolved and the BIA\'s message')
        shot('12-resident-sees-resolved')
        go('/notifications'); pg.wait_for_timeout(500)
        cap('Visible outcome 2: a notification for the resident')
        shot('13-notification-resolved')
        go('/pulse'); pg.wait_for_timeout(600)
        cap('Visible outcome 3: Pulse lists the issue as Resolved')
        shot('14-pulse-resolved')
        go('/map', 'Nearby in'); pg.wait_for_timeout(600)
        pg.get_by_role('searchbox').fill('Broken bench'); pg.wait_for_timeout(900)
        cap('Visible outcome 4: on the map the same issue now reads Resolved')
        pg.get_by_role('button', name=re.compile('Broken bench on Riverside')).first.click(); pg.wait_for_timeout(1000)
        shot('15-map-issue-resolved')

        # 8. Follow-up reopens
        go(f'/messages?id={req_id}', 'Bench repaired')
        pg.get_by_label('What is still wrong?').fill('It is loose again.')
        cap('Step 9 · If the problem remains, the resident follows up and the request reopens')
        pg.get_by_role('button', name='Follow up').click(); pg.wait_for_timeout(700)
        shot('16-resident-follow-up-reopened')

        # 9. Outside the corridor
        go('/issues/report', 'Report an issue')
        cap('Edge case · A problem outside the corridor stays on the map and is NOT sent to the BIA')
        pg.locator("#t").fill('Dark street downtown')
        pg.get_by_label('Where is it?').select_option(label='Downtown riverfront')
        pg.get_by_role('button', name='File report').click()
        expect(pg.get_by_text('No BIA covers this location')).to_be_visible(timeout=10000)
        shot('17-report-outside-corridor-not-routed')

        # 10. Business workspace
        go('/marketplace', 'Marketplace')
        cap('Second request type · A person asks the bakery for an address from a Marketplace offer')
        shot('18-marketplace-offer')
        pg.get_by_role('button', name=re.compile('Request address')).first.click(); pg.wait_for_timeout(800)
        go('/business', 'Sample Riverside Bakery')
        tab('Requests')
        cap('The request appears in the Business workspace (Sample Riverside Bakery)')
        open_request('Address request')
        shot('19-business-requests')
        tab('Overview'); cap('Business workspace overview: open requests now include the new one', 1500)
        shot('20-business-overview')
        tab('Roles & access'); cap('Roles and access in the business workspace', 1200)
        shot('21-business-roles')
        go('/bia', 'Corridor directory'); tab('Roles & access'); cap('Roles and access in the BIA workspace', 1200)
        shot('22-bia-roles')
        tab('Overview'); cap('BIA workspace overview after the journey', 1500)
        shot('23-bia-overview')
        pg.evaluate("sessionStorage.removeItem('__cap')")
        ctx.close(); b.close()

if __name__ == '__main__':
    run(record=True)
    print(json.dumps(log, indent=1))
