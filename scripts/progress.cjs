/* Progress walkthrough: counted reps on the Progress tab, the stretches, the parent page and the drafts.
   Run: URL=http://localhost:4174/ node scripts/progress.cjs   (DEVICE="Pixel 5" for Android) */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = process.env.URL || 'http://localhost:4174/';
const fails = [];
function expect(label, got, want) { if (JSON.stringify(got) !== JSON.stringify(want)) { fails.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); console.log('  !! MISMATCH', label, JSON.stringify(got), 'want', JSON.stringify(want)); } else console.log('  ok', label); }
const shotsDir = path.join(__dirname, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails.push('pageerror ' + e.message); });
  const settle = (ms = 350) => page.waitForTimeout(ms);
  const shot = (name, full = false) => page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: full });
  await page.goto(URL); await page.waitForSelector('text=Start here');
  await page.click('role=button[name="Try the demo team first"]'); await page.waitForURL(/\/practices\//, { timeout: 60000 });

  // Ellis: the kid whose backhand went from mostly bobbled to mostly clean
  await page.goto(URL + '#/players/demo-p04'); await page.waitForSelector('h1');
  await page.getByRole('button', { name: 'Progress', exact: true }).click(); await settle();
  const card = page.locator('[data-progress-card="coach"]');
  let t = await card.innerText();
  expect('coach card is there, on Last 5', /Counted reps, over time/i.test(t) && (await card.locator('.chip.on').innerText()) === 'Last 5', true);
  expect('stretch says five sessions with dates', /From his last 5 sessions, \w{3} \d+ to \w{3} \d+\. 16 counted reps\./.test(t), true);
  expect('backhand counted for the stretch and before it', /Backhand side\s*10 of 12 clean · before that 4 of 12/.test(t), true);
  expect('the change is called up', /Backhand side[\s\S]{0,60}Up/.test(t), true);
  expect('a gap that could be luck reads about the same', /Throws\s*13 of 16 on target · before that 9 of 16\s*About the same/.test(t), true);
  expect('four reps is too few to call', /Forehand side\s*4 of 4 clean · before that 3 of 4\s*Too few to call/.test(t), true);
  expect('says how a change is called', /at least 8 counted reps and the gap is bigger than luck/.test(t), true);
  await card.scrollIntoViewIfNeeded(); await shot('30_progress_coach');

  await card.getByRole('button', { name: 'Last practice' }).click(); await settle(200);
  t = await card.innerText();
  expect('last practice is one session', /From his last session, \w{3} \d+\. 4 counted reps\./.test(t), true);
  expect('last practice count with everything before', /Backhand side\s*3 of 3 clean · before that 11 of 21/.test(t), true);
  expect('one practice is too few reps to call a change', /Too few to call/.test(t) && !/\nUp\b/.test(t), true);
  await card.getByRole('button', { name: 'Everything' }).click(); await settle(200);
  t = await card.innerText();
  expect('everything is cumulative with no before', /everything recorded, 9 sessions/.test(t) && /Backhand side\s*14 of 24 clean/.test(t) && !/before that/.test(t), true);
  await card.getByRole('button', { name: 'Last 5' }).click(); await settle(200);

  // The parent page from the coach's tab
  await card.getByRole('button', { name: 'Open the parent page' }).click();
  await page.waitForSelector('.sheet iframe');
  let frame = page.frameLocator('.sheet iframe'); await frame.locator('body').waitFor();
  let doc = await frame.locator('body').innerText();
  expect('page is his, with the team brand on top', /Ellis's progress/.test(doc) && /Dirtbags/.test(doc), true);
  expect('page shows the count, the stretch before and the change', /Backhand side\s*10 of 12 clean\s*4 of 12\s*Up/.test(doc) && /Throws\s*13 of 16 on target\s*9 of 16\s*About the same/.test(doc), true);
  expect('page shows the level then and now', /Infield defense[\s\S]{0,40}2 Building\s*was 1 Introducing on \w{3} \d+/.test(doc), true);
  expect('narrated reps are not counted a second time as quick reads', /quick reads, by area/i.test(doc), false);
  expect('page shows what he is working on', /Working on now[\s\S]*Backhand: right foot plants/.test(doc), true);
  expect('page explains how to read it', /bigger than luck would explain/.test(doc) && /Nothing here is a ranking/.test(doc), true);
  expect('no other kid, no private notes, no raw note text', /Sam|Jonah|Theo|Nico|Short-arms|Backhand footwork|Listens/.test(doc), false);
  expect('sheet has Print and Share', (await page.locator('.sheet >> role=button[name="Print"]').count()) === 1 && (await page.locator('.sheet >> role=button[name="Share"]').count()) === 1, true);
  const html = await page.locator('.sheet iframe').getAttribute('srcdoc');
  fs.writeFileSync(path.join(shotsDir, 'progress-page-ellis.html'), html);
  await shot('31_progress_page_sheet');
  await page.locator('.sheet-head >> role=button[name="Close"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });

  // Family tab: the same numbers with the ways to send them
  await page.getByRole('button', { name: 'Family', exact: true }).click(); await settle();
  const fam = page.locator('[data-progress-card="family"]');
  t = await fam.innerText();
  expect('family card is there', /How Ellis is doing, over time/i.test(t) && /drafts only; you tap send/.test(t), true);
  expect('family card says what never goes in', /What never goes in: note text, your private notes, or any other kid/.test(t), true);
  await fam.getByRole('button', { name: 'Text it' }).click(); await page.waitForSelector('.sheet pre');
  const draft = await page.locator('.sheet pre').innerText();
  expect('text draft opens with the stretch', /^Hi, (Coach \w+|coach) here with where Ellis is, from his last 5 sessions, \w{3} \d+ to \w{3} \d+\./.test(draft), true);
  expect('text draft leads with the win', /Counted reps: fielding the ball 14 of 16 clean \(up from 7 of 16\); backhand side 10 of 12 clean \(up from 4 of 12\)\./.test(draft), true);
  expect('text draft is honest about the sample', /not every rep he took/.test(draft), true);
  expect('no phone on file means it says so instead of opening Messages', (await page.locator('.sheet-foot').innerText()).includes('Add a phone first'), true);
  await shot('32_progress_text_draft');
  await page.locator('.sheet-head >> role=button[name="Close"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
  await fam.getByRole('button', { name: 'Email it' }).click(); await page.waitForSelector('.sheet pre');
  const mail = await page.locator('.sheet').innerText();
  expect('email draft has a subject and every count', /Subject: Ellis: how things are going/.test(mail) && /- Backhand side: 10 of 12 clean; before that 4 of 12\. Up\./.test(mail), true);
  await page.locator('.sheet-head >> role=button[name="Close"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
  await fam.scrollIntoViewIfNeeded(); await shot('33_progress_family');

  // Jonah: a steady kid reads "about the same", and a level set now is logged for later
  await page.goto(URL + '#/players/demo-p02'); await page.waitForSelector('h1');
  await page.getByRole('button', { name: 'Progress', exact: true }).click(); await settle();
  t = await page.locator('[data-progress-card="coach"]').innerText();
  expect('a small gap with enough reps reads about the same', /Getting to the ball\s*6 of 10 charged it · before that 6 of 11\s*About the same/.test(t), true);
  await page.locator('.item.tappable', { hasText: 'Outfield defense' }).click(); await page.waitForSelector('.sheet');
  await page.locator('.sheet').getByRole('button', { name: /^4 Reliable/ }).click();
  await page.locator('.sheet-foot >> role=button[name="Save"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
  await page.locator('[data-progress-card="coach"]').getByRole('button', { name: 'Open the parent page' }).click();
  await page.waitForSelector('.sheet iframe'); frame = page.frameLocator('.sheet iframe'); await frame.locator('body').waitFor();
  doc = await frame.locator('body').innerText();
  expect('a level changed today shows where he was', /Outfield defense[\s\S]{0,40}4 Reliable\s*was 3 Steady/.test(doc), true);
  expect('Jonah page has no other kid', /Ellis|Sam|Theo/.test(doc), false);
  await page.locator('.sheet-head >> role=button[name="Close"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });

  // A kid with nothing counted: the card says where counts come from, the page says so plainly
  await page.goto(URL + '#/players/demo-p12'); await page.waitForSelector('h1');
  await page.getByRole('button', { name: 'Progress', exact: true }).click(); await settle();
  t = await page.locator('[data-progress-card="coach"]').innerText();
  expect('no counts explains Narrate', /No counted reps in this stretch\. They come from Narrate/.test(t), true);
  await page.locator('[data-progress-card="coach"]').getByRole('button', { name: 'Open the parent page' }).click();
  await page.waitForSelector('.sheet iframe'); frame = page.frameLocator('.sheet iframe'); await frame.locator('body').waitFor();
  doc = await frame.locator('body').innerText();
  expect('empty page says so and still shows his levels', /No reps have been counted for Hank/.test(doc) && /Hitting[\s\S]{0,20}3 Steady/.test(doc), true);
  await page.locator('.sheet-head >> role=button[name="Close"]').click();

  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED\n` + fails.join('\n') : '\nALL CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
