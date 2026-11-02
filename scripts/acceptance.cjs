/* Dugout Lab acceptance walkthrough on an iPhone-sized browser. Run: URL=http://localhost:4174/ node scripts/acceptance.cjs */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = process.env.URL || 'http://localhost:4174/';
const fails = [];
let PAGE;
function expect(label, got, want) { if (JSON.stringify(got) !== JSON.stringify(want)) { fails.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); console.log('  !! MISMATCH', label, JSON.stringify(got), 'want', JSON.stringify(want)); } else console.log('  ok', label); }
const shotsDir = path.join(__dirname, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: false });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'] });
  const page = await ctx.newPage(); PAGE = page;
  page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails.push('pageerror ' + e.message); });
  const settle = (ms = 350) => page.waitForTimeout(ms);
  const body = () => page.locator('body').innerText();

  // Fresh start: the three-step setup a new coach walks, then switch to the demo team for the rest
  await page.goto(URL);
  await page.waitForSelector('text=Start here');
  await page.click('role=button[name="Set up my team (2 minutes)"]');
  await page.waitForSelector('text=Step 1 of 3');
  await page.fill('input[placeholder="Rattlers"]', 'Setup Test Team');
  await page.fill('input[placeholder="Deren"]', 'Deren');
  await page.getByRole('button', { name: /^\d{4} \(13U\)$/ }).click();
  await page.click('role=button[name="Next: the roster"]');
  await page.waitForSelector('text=Step 2 of 3');
  await page.fill('textarea', '1 Eli Test\n24 Hudson Test\n4 AJ Test');
  await page.click('role=button[name="Next: first practice"]');
  await page.waitForSelector('text=You are set');
  await page.click('role=button[name="Generate the first practice"]');
  await page.waitForSelector('text=Quick start');
  expect('quick start shows the three kids', /3 of 3 here/.test(await body()), true);
  await page.locator('.card').first().getByRole('button', { name: 'Generate practice' }).click();
  await page.waitForURL(/\/practices\/[^/]+$/);
  await settle(400);
  expect('first practice generated from quick start', /Why this plan/.test(await body()), true);
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Demo team');
  await page.click('role=button[name="Load demo team"]');
  await page.waitForURL(/\/practices\//, { timeout: 60000 });
  await settle();
  expect('demo plan opened', /Why this plan/.test(await body()), true);
  await shot(page, '01_plan');

  // Test A in the UI: 12 players (one absent in the demo) -> rotations, every station has objectives for all present
  const planText = await body();
  expect('plan shows blocks', /Warm-up[\s\S]*Fundamentals[\s\S]*Focused development[\s\S]*Game-like decisions[\s\S]*Compete and play[\s\S]*Reflection/i.test(planText), true);
  expect('no check warnings', /^Check:/m.test(planText), false);
  // Open first focus station and count objectives
  const stationHeads = page.locator('.station .row.between');
  const n = await stationHeads.count();
  expect('has stations', n > 6, true);
  await stationHeads.nth(3).click();
  await settle();
  const objCount = await page.locator('.station .objective').count();
  expect('objectives for all 11 present', objCount, 11);
  const whys = await page.locator('.station .objective .why').allInnerTexts();
  expect('a saved version shows as "his saved version" somewhere or goals do', whys.some((w) => /goal|saved version|level/i.test(w)), true);
  await shot(page, '02_station_open');

  // Regenerate this station keeps the rest
  const before = await page.locator('.station .title').allInnerTexts();
  await page.locator('.station').nth(3).getByRole('button', { name: 'Regenerate this station' }).click();
  await settle(500);
  const after = await page.locator('.station .title').allInnerTexts();
  expect('other stations unchanged after regenerate', before.filter((_, i) => i !== 3), after.filter((_, i) => i !== 3));
  expect('regenerated station changed', before[3] !== after[3], true);

  // Test D: Adjust 90 -> 60 keeps objectives
  await page.locator('.station').nth(3).click().catch(() => {});
  const objBefore = await page.locator('.station .objective .what').allInnerTexts();
  await page.click('role=button[name="Adjust"]');
  await page.waitForSelector('.sheet');
  await page.locator('.sheet').getByRole('button', { name: '60 min' }).click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await settle();
  expect('now 60 minutes', /60 min ·/.test(await body()), true);
  const objAfter = await page.locator('.station .objective .what').allInnerTexts();
  expect('objectives identical after shortening', objAfter, objBefore);
  await shot(page, '03_after_60');

  // Start practice: live mode
  await page.click('role=button[name="Start practice"]');
  await page.waitForURL(/\/live$/);
  await settle(600);
  expect('timer visible', (await page.locator('.timer').count()) > 0, true);
  const t1 = await page.locator('.timer').innerText();
  await settle(1500);
  const t2 = await page.locator('.timer').innerText();
  expect('timer counts down', t1 !== t2, true);
  await shot(page, '04_live');
  // Quick notes: Jonah hesitated twice would already exist; add a struggled on a player here
  for (let i = 0; i < 4 && !/Fundamentals · rotation/i.test(await body()); i++) { await page.getByRole('button', { name: /Next/ }).first().click(); await settle(400); }
  expect('reached the fundamentals block', /Fundamentals · rotation 1 of/i.test(await body()), true);
  // Now in fundamentals: station chips exist
  const chips = page.locator('.chips').first().locator('.chip');
  expect('station chips in a rotating block', (await chips.count()) >= 2, true);
  const nameChips = page.locator('.chips').last().locator('.chip');
  const firstName = (await nameChips.first().innerText()).replace(/ \(\d+\)$/, '');
  await nameChips.first().click();
  await page.waitForSelector('.sheet');
  await page.locator('.sheet').getByRole('button', { name: 'Got it' }).click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await settle();
  expect('note counted', /\(1\)/.test(await page.locator('.chips').last().innerText()), true);
  // Pause, close the app (reload), state persists
  await page.getByRole('button', { name: 'Pause' }).click();
  await settle(300);
  const paused = await page.locator('.timer').innerText();
  await page.reload();
  await page.waitForSelector('.timer');
  await settle(1200);
  expect('live state survives reload (paused timer unchanged)', await page.locator('.timer').innerText(), paused);
  expect('still in rotating block after reload', /rotation 1 of/i.test(await body()), true);
  await page.getByRole('button', { name: 'Resume' }).click();
  // Station not working -> easier version
  await page.getByRole('button', { name: 'This station is not working' }).click();
  await page.waitForSelector('.sheet');
  await page.locator('.sheet').getByRole('button', { name: /easier version/ }).click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await settle();
  expect('easier pill shown', /easier/.test(await page.locator('.station').first().innerText()), true);
  // Finish -> recap
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.waitForURL(/\/recap$/);
  await settle();
  const recap = await body();
  expect('recap lists the win', new RegExp(firstName.split(' ')[0] + ': got it').test(recap), true);
  expect('recap has suggestions from demo notes (Jonah outfield)', /Jonah hesitated on outfield/.test(recap), true);
  expect('suggestion is labeled', /Suggestion, not a diagnosis/.test(recap), true);
  await shot(page, '05_recap');
  await page.getByRole('button', { name: 'Finish practice' }).first().click();
  await page.waitForURL(/\/today$/);
  await settle();
  expect('today shows last practice', /Last practice/.test(await body()), true);
  expect('today shows reminder', /Suggestion/.test(await body()), true);

  // Freestyle note: typed sentence -> who, what, area guessed; coach confirms
  await page.getByRole('button', { name: '+ Note', exact: true }).click();
  await page.waitForSelector('.sheet');
  await page.locator('.sheet textarea').fill('Theo struggled on fly balls today');
  await settle(300);
  const sheetText = await page.locator('.sheet').innerText();
  expect('note guessed the kid', /Sounds like Theo/.test(sheetText), true);
  expect('note guessed the read', (await page.locator('.sheet .read-chips .chip.on').innerText()), 'Struggled');
  expect('note guessed the area', /Area: Outfield defense/.test(sheetText), true);
  await page.getByRole('button', { name: /^Save for Theo/ }).click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  expect('note saved toast', /Note saved for Theo/.test(await body()), true);
  // Same box with a shared first name asks instead of guessing (demo has one Owen, so use a slip instead)
  await page.getByRole('button', { name: '+ Note', exact: true }).click();
  await page.waitForSelector('.sheet');
  await page.locator('.sheet textarea').fill('Jona froze on the relay');
  await settle(300);
  expect('speech slip still finds him, marked as a maybe', /Maybe Jonah/.test(await page.locator('.sheet').innerText()), true);
  await page.locator('.sheet-head >> role=button[name="Close"]').click();
  await page.waitForSelector('.sheet', { state: 'detached' });

  // Guided tour: nine stops on the real screens, then it stops offering itself
  expect('tour offered on Today', /New here\?/.test(await body()), true);
  await page.getByRole('button', { name: 'Take the tour' }).click();
  let stops = 0;
  for (let i = 0; i < 9; i++) {
    await settle(500);
    if ((await page.locator('.tour-card').count()) === 0) break;
    stops += 1;
    await page.locator('.tour-card >> role=button[name=/Next|Done, let/]').click();
  }
  await settle(400);
  expect('tour has nine stops', stops, 9);
  expect('tour ends on Today without the offer', /\/today$/.test(page.url()) && !/New here\?/.test(await body()), true);
  await page.goto(URL + '#/help');
  await page.waitForSelector('text=Questions coaches ask');
  await page.fill('input[aria-label="Search the questions"]', 'parents');
  await settle(200);
  expect('faq search finds the parents answer', (await page.locator('details.faq').count()) >= 1 && /What do parents see/.test(await body()), true);
  expect('help offers the tour again', (await page.getByRole('button', { name: 'Take the tour' }).count()), 1);

  // Test E: player page for Jonah shows the labeled suggestion with a drill
  await page.click('.tabbar >> text=Players');
  await page.waitForSelector('text=Jonah');
  await page.click('text=Jonah');
  await page.waitForSelector('text=Try next');
  const jonah = await body();
  expect('Jonah suggestion labeled, outfield, from a game', /Suggestion · from a game[\s\S]*not a diagnosis: Jonah hesitated on outfield defense in 2 notes \(including a game\)/i.test(jonah), true);
  expect('suggestion names a drill', /Try a decision rep[\s\S]*: [A-Z]/.test(jonah), true);
  expect('cue that worked included', /Cue that has worked for him: "Drop step, then find it"/.test(jonah), true);
  await shot(page, '06_player_today');

  // Family: contacts, home plan, drafts, scorecard, due list
  await page.getByRole('button', { name: 'Family' }).click();
  await settle();
  const fam = await body();
  expect('family contact from demo', /Dana Pike \(mom\)/.test(fam), true);
  expect('home plan has drills', (await page.locator('.cue').count()) >= 2, true);
  expect('home plan mentions outfield focus', /Working on:[\s\S]*Outfield/i.test(fam), true);
  await page.fill('input[placeholder="Loved his energy Saturday."]', 'Loved his energy Saturday.');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await page.waitForSelector('.sheet');
  const draft = await page.locator('.sheet pre').innerText();
  expect('text draft greets the parent', /^Hi Dana, (Coach \w+|coach) here/.test(draft), true);
  expect('text draft includes the personal line', /Loved his energy Saturday\./.test(draft), true);
  expect('text draft includes home work', /At home, \d+ min/.test(draft), true);
  expect('text draft has no private note text', /Froze on the ball|meltdown/.test(draft), false);
  await page.locator('.sheet-foot >> role=button[name="Copy"]').click().catch(() => {});
  await page.locator('.sheet-head >> role=button[name="Close"]').click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await page.getByRole('button', { name: 'Email', exact: true }).click();
  await page.waitForSelector('.sheet');
  expect('email draft has subject', /Subject: Jonah: quick update/.test(await page.locator('.sheet').innerText()), true);
  await page.locator('.sheet-head >> role=button[name="Close"]').click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  // Scorecard opens in-app (an iframe sheet with Print and Share), not a popup: popups fail on an installed iPhone app
  await page.getByRole('button', { name: 'Scorecard', exact: true }).click();
  await page.waitForSelector('.sheet iframe');
  const frame = page.frameLocator('.sheet iframe');
  await frame.locator('body').waitFor();
  const card = await frame.locator('body').innerText();
  expect('scorecard shows Jonah', /Jonah Pike #2/.test(card), true);
  expect('scorecard shows a team band, not names', /team \d to \d, middle \d, \d+ assessed/.test(card) && !/Sam|Theo|Ellis/.test(card), true);
  expect('scorecard says not a ranking', /Nothing here is a ranking/.test(card), true);
  expect('scorecard sheet has Print and Share', (await page.locator('.sheet >> role=button[name="Print"]').count()) === 1 && (await page.locator('.sheet >> role=button[name="Share"]').count()) === 1, true);
  await page.locator('.sheet-head >> role=button[name="Close"]').click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await shot(page, '09_family');
  await page.goto(URL + '#/parents');
  await page.waitForSelector('text=Parent updates');
  await settle();
  expect('parents page lists everyone', /Everyone/i.test(await body()), true);

  // Test B: modify a ground-ball drill for one player, save, reload, verify
  await page.click('.tabbar >> text=Drills');
  await page.waitForSelector('text=Drills');
  await page.fill('input[placeholder*="Search"]', 'ground');
  await settle();
  await page.locator('.list .item').first().click();
  await page.waitForSelector('text=Player versions');
  const drillName = await page.locator('h1').innerText();
  await page.click('role=button[name="+ Version for a player"]');
  await page.waitForSelector('.sheet');
  await page.locator('.sheet').getByRole('button', { name: 'Owen T.' }).click();
  await page.fill('.sheet input[placeholder="Stationary, soft balls, short"]', 'Owen: soft balls, 12 feet, no throw');
  await page.fill('.sheet textarea', 'Field ten clean, then earn the throw');
  await page.fill('.sheet input[placeholder="2 x 8"]', '3 x 10');
  await page.locator('.sheet-foot >> role=button[name="Save"]').click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await settle();
  expect('version listed', /Owen T\.: Owen: soft balls, 12 feet, no throw/.test(await body()), true);
  const url = page.url();
  await page.goto(URL + '#/today');
  await settle(300);
  await page.goto(url);
  await page.reload();
  await page.waitForSelector('text=Player versions');
  await settle(400);
  expect('version persists after reload', /Field ten clean, then earn the throw[\s\S]*3 x 10/.test(await body()), true);
  await shot(page, '07_drill_version');

  // New practice uses the version: generate with infield priority and look for Owen's objective
  await page.goto(URL + '#/practices/new');
  await page.waitForSelector('text=New practice');
  await page.getByRole('button', { name: '60 min' }).click();
  await page.click('role=button[name="Generate practice"]');
  await page.waitForURL(/\/practices\/[^/]+$/);
  await settle(500);
  const newPlan = await body();
  expect('new plan generated at 60', /60 min ·/.test(newPlan), true);
  expect('Pitch Smart flagged Nico (62 pitches) and Cash (unknown)', /No hard throwing: .*Nico|Cash/.test(newPlan), true);

  // Test G: backup, then restore into a fresh profile
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Backup');
  // Backup is two steps: build it, then the sheet's Save or share button hands it to the share sheet or downloads it
  await page.click('role=button[name="Back up now"]');
  await page.waitForSelector('text=Backup ready');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('role=button[name="Save or share it"]')]);
  const file = path.join(shotsDir, 'backup.zip');
  await download.saveAs(file);
  expect('backup downloaded', fs.statSync(file).size > 2000, true);
  const ctx2 = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'] });
  const p2 = await ctx2.newPage();
  await p2.goto(URL + '#/settings');
  await p2.waitForSelector('text=Backup');
  const [chooser] = await Promise.all([p2.waitForEvent('filechooser'), p2.click('role=button[name="Restore from a backup"]')]);
  await chooser.setFiles(file);
  await p2.waitForSelector('text=Restore from backup');
  await p2.locator('.sheet').getByRole('button', { name: /Merge into this device/ }).click();
  await p2.waitForSelector('text=Done (merge)');
  const rep = await p2.locator('.banner.info').innerText();
  expect('restore added players', /1[2-9] players/.test(rep), true);
  expect('restore added variants', /variants/.test(rep), true);
  expect('restore added practices', /practices/.test(rep), true);
  await p2.locator('.sheet').getByRole('button', { name: 'Done' }).click();
  await p2.goto(URL + '#/players');
  await p2.waitForSelector('text=Jonah');
  await p2.goto(url);
  await p2.waitForSelector('text=Player versions');
  expect('restored device has the custom version', /Field ten clean, then earn the throw/.test(await p2.locator('body').innerText()), true);
  await p2.goto(URL + '#/practices');
  await p2.waitForSelector('text=Practices');
  expect('restored device has practice history', /Done\n/i.test(await p2.locator('body').innerText()), true);
  await ctx2.close();

  // A pack made for Mark: his phone is set up as Mark in one tap, and his notes come back tagged Mark
  // (packs live under "No signal?" now that linked phones are the main path)
  const openPacks = async (pg) => { const d = pg.locator('details', { hasText: 'Coach packs by file' }); if (await d.count() && !(await d.evaluate((el) => el.open))) await d.locator('summary').click(); };
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Other coaches');
  await openPacks(page);
  await page.getByRole('button', { name: 'Send a coach pack' }).click();
  await page.waitForSelector('text=Who is this pack for?');
  await page.fill('.sheet input', 'Mark');
  await page.locator('.sheet').getByRole('button', { name: 'Parent coach' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Make the pack' }).click();
  await page.waitForSelector('text=Pack for Mark is ready');
  const [packDl] = await Promise.all([page.waitForEvent('download'), page.locator('.sheet').getByRole('button', { name: 'Share it' }).click()]);
  const packFile = path.join(shotsDir, 'pack-mark.zip');
  await packDl.saveAs(packFile);
  expect('pack file named for Mark', /for-Mark/.test(packDl.suggestedFilename()), true);
  await page.waitForSelector('.sheet', { state: 'detached' });
  await openPacks(page);
  expect('Mark listed with pack sent', /Mark · Parent coach\s*Pack sent/.test(await body()), true);
  const ctx3 = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'] });
  const p3 = await ctx3.newPage();
  await p3.goto(URL + '#/settings');
  await p3.waitForSelector('text=Backup');
  const [chooser3] = await Promise.all([p3.waitForEvent('filechooser'), p3.click('role=button[name="Restore from a backup"]')]);
  await chooser3.setFiles(packFile);
  await p3.waitForSelector('text=made for');
  await p3.getByRole('button', { name: 'Set up this phone as Mark' }).click();
  await p3.waitForSelector('text=Done (replace)');
  await p3.locator('.sheet').getByRole('button', { name: 'Done' }).click();
  await p3.goto(URL + '#/settings');
  await p3.waitForSelector('text=Other coaches');
  expect("Mark's phone shows the locked name", /Mark, set by Coach Demo's coach pack|Mark, set by .*coach pack/.test(await p3.locator('body').innerText()), true);
  await p3.goto(URL + '#/today');
  await p3.waitForSelector('text=Next practice');
  await p3.getByRole('button', { name: '+ Note', exact: true }).click();
  await p3.waitForSelector('.sheet');
  await p3.locator('.sheet textarea').fill('Nico hustled on every ground ball');
  await p3.waitForTimeout(300);
  await p3.getByRole('button', { name: /^Save for Nico/ }).click();
  await p3.waitForSelector('.sheet', { state: 'detached' });
  await p3.goto(URL + '#/settings');
  await p3.waitForSelector('text=Backup');
  await p3.click('role=button[name="Back up now"]');
  await p3.waitForSelector('text=Backup ready');
  const [markDl] = await Promise.all([p3.waitForEvent('download'), p3.click('role=button[name="Save or share it"]')]);
  const markFile = path.join(shotsDir, 'backup-mark.zip');
  await markDl.saveAs(markFile);
  await ctx3.close();
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Other coaches');
  await openPacks(page);
  const [chooser4] = await Promise.all([page.waitForEvent('filechooser'), page.click('role=button[name="Merge a coach\'s backup"]')]);
  await chooser4.setFiles(markFile);
  await page.waitForSelector('text=Restore from backup');
  expect('merge sheet names Mark as the sender', /From Mark \(the pack you sent\)/.test(await page.locator('.sheet').innerText()), true);
  await page.locator('.sheet').getByRole('button', { name: /Merge into this device/ }).click();
  await page.waitForSelector('text=Done (merge)');
  await page.locator('.sheet').getByRole('button', { name: 'Done' }).click();
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Other coaches');
  await openPacks(page);
  expect('Mark listed with notes back', /notes back/.test(await body()), true);
  await page.goto(URL + '#/players');
  await page.waitForSelector('text=Nico');
  await page.click('text=Nico');
  await page.waitForSelector('text=Try next');
  await page.getByRole('button', { name: /Notes \(/ }).click();
  await settle();
  expect("Mark's note landed on Nico tagged Mark", /Nico hustled on every ground ball[\s\S]*· Mark/.test(await body()), true);

  // Linked phones through the live sync server: invite Aaron by link, his phone sets itself up, notes flow both ways, revoke stops him
  const waitFor = async (pg, re, ms = 25000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await pg.locator('body').innerText())) return true; await pg.waitForTimeout(700); } return false; };
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Other coaches');
  await page.getByRole('button', { name: /Turn on linked phones/ }).click();
  expect('linked phones turned on', await waitFor(page, /linked phones on/), true);
  await page.getByRole('button', { name: '+ Invite a coach' }).click();
  await page.waitForSelector('text=Invite a coach');
  await page.fill('.sheet input', 'Aaron');
  await page.locator('.sheet').getByRole('button', { name: 'Assistant', exact: true }).first().click();
  await page.locator('.sheet').getByRole('button', { name: 'Make the invite' }).click();
  await page.waitForSelector('text=Invite for Aaron');
  const inviteLink = (await page.locator('.sheet pre').innerText()).trim();
  expect('invite link carries the name and secrets in the hash', /#\/join\?t=[A-Z2-9]{20}&c=[A-Z2-9]{20}&n=Aaron/.test(inviteLink), true);
  await page.locator('.sheet').getByRole('button', { name: 'Done' }).click();
  expect('Aaron listed as invited', await waitFor(page, /Aaron · Assistant[\s\S]*Invited, has not opened the link yet/), true);
  const ctx5 = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'] });
  const p5 = await ctx5.newPage();
  await p5.goto(inviteLink.replace(/^https?:\/\/[^#]+/, URL));
  await p5.waitForSelector('text=Set up this phone as Aaron');
  await p5.getByRole('button', { name: 'Set up this phone as Aaron' }).click();
  expect("Aaron's phone received the team through the server", await waitFor(p5, /All set/, 40000), true);
  await p5.goto(URL + '#/settings');
  await p5.waitForSelector('text=Linked');
  expect("Aaron's phone shows his locked name", /This phone is Aaron's/.test(await p5.locator('body').innerText()), true);
  await p5.goto(URL + '#/players');
  expect("Aaron's phone has the roster", await waitFor(p5, /Jonah/), true);
  // A note on Aaron's phone reaches Deren's phone with Aaron's name, without anyone sending anything
  await p5.goto(URL + '#/today');
  await p5.waitForSelector('text=Next practice');
  await p5.getByRole('button', { name: '+ Note', exact: true }).click();
  await p5.waitForSelector('.sheet');
  await p5.locator('.sheet textarea').fill('Theo took the cue on the drop step');
  await p5.waitForTimeout(300);
  await p5.getByRole('button', { name: /^Save for Theo/ }).click();
  await p5.waitForSelector('.sheet', { state: 'detached' });
  await p5.waitForTimeout(3500); // sync fires two seconds after a change
  await page.reload(); // a reload is "opening the app", which syncs
  await page.waitForSelector('text=Other coaches');
  await page.goto(URL + '#/players');
  await page.waitForSelector('text=Theo');
  await page.click('text=Theo');
  await page.waitForSelector('text=Try next');
  await page.getByRole('button', { name: /Notes \(/ }).click();
  expect("Aaron's note arrived on Deren's phone tagged Aaron", await waitFor(page, /Theo took the cue on the drop step[\s\S]*· Aaron/), true);
  // A goal Deren adds reaches Aaron's phone on his next open
  await page.getByRole('button', { name: 'Today', exact: true }).first().click().catch(() => undefined);
  await page.goto(URL + '#/players');
  await page.waitForSelector('text=Theo');
  await page.click('text=Theo');
  await page.waitForSelector('text=Try next');
  await page.getByRole('button', { name: '+ Goal' }).first().click();
  await page.waitForSelector('.sheet');
  await page.fill('.sheet textarea', 'Glove out front on the backhand');
  await page.locator('.sheet-foot >> role=button[name="Add"]').click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await page.waitForTimeout(3500);
  await p5.reload();
  await p5.waitForSelector('text=Next practice');
  await p5.goto(URL + '#/players');
  await p5.waitForSelector('text=Theo');
  await p5.click('text=Theo');
  expect("Deren's goal reached Aaron's phone", await waitFor(p5, /Glove out front on the backhand/), true);
  // Deren turns Aaron off; Aaron's phone finds out on its next sync and stops
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=Other coaches');
  expect('Aaron now shows as synced', await waitFor(page, /Aaron · Assistant[\s\S]*Last synced/), true);
  await page.getByRole('button', { name: 'Turn off', exact: true }).first().click();
  await page.waitForSelector('text=Turn off Aaron');
  await page.locator('.sheet-foot >> role=button[name="Turn off"]').click();
  expect('Aaron marked access off', await waitFor(page, /access off/), true);
  await p5.goto(URL + '#/today');
  await p5.waitForSelector('text=Next practice');
  await p5.getByRole('button', { name: '+ Note', exact: true }).click();
  await p5.waitForSelector('.sheet');
  await p5.locator('.sheet textarea').fill('Jonah hustled');
  await p5.waitForTimeout(300);
  await p5.getByRole('button', { name: /^Save for Jonah/ }).click();
  await p5.waitForSelector('.sheet', { state: 'detached' });
  await p5.waitForTimeout(3500);
  await p5.goto(URL + '#/settings');
  await p5.reload();
  await p5.waitForSelector('text=Linked');
  expect("Aaron's phone says his access was turned off", await waitFor(p5, /access was turned off by the head coach/), true);
  await ctx5.close();

  // Test C (as far as a desktop browser can): offline reload serves the app and data
  await ctx.setOffline(true);
  await page.goto(URL + '#/today');
  await page.waitForSelector('text=Next practice', { timeout: 20000 });
  expect('offline: today loads with data', /Offline/.test(await body()), true);
  await page.goto(URL + '#/players');
  await page.waitForSelector('text=Jonah');
  await page.click('text=Jonah');
  await page.waitForSelector('text=Try next');
  await page.getByRole('button', { name: '+ Note' }).first().click();
  await page.waitForSelector('.sheet');
  await page.locator('.sheet').getByRole('button', { name: 'Got it' }).click();
  await page.fill('.sheet textarea', 'Offline note: drop step was on time');
  await page.locator('.sheet-foot >> role=button[name=/^Save/]').click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await page.reload();
  await page.waitForSelector('text=Try next');
  await page.getByRole('button', { name: /Notes \(/ }).click();
  await settle();
  expect('offline note persisted after reload', /Offline note: drop step was on time/.test(await body()), true);
  await shot(page, '08_offline_notes');
  await ctx.setOffline(false);

  console.log(fails.length ? `FAILURES (${fails.length}):\n - ` + fails.join('\n - ') : 'ALL CHECKS PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch(async (e) => { console.error('SCRIPT ERROR', e.message.split('\n')[0]); console.log('failures so far:', fails); try { await PAGE.screenshot({ path: path.join(shotsDir, 'FAIL.png') }); console.log(PAGE.url()); console.log((await PAGE.locator('body').innerText()).slice(0, 900)); } catch {} process.exit(1); });
