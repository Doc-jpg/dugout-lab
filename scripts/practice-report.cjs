/* Practice report walkthrough: finish a practice, check every coach's notes are in, read a kid's report,
   put a note in, take a line out, share it as a PDF, and see the list move to the next kid.
   Made-up kids only (the demo team).
   Run: URL=http://localhost:4174/ node scripts/practice-report.cjs   (DEVICE="Pixel 5" for Android) */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = process.env.URL || 'http://localhost:4174/';
const fails = [];
function expect(label, got, want) { if (JSON.stringify(got) !== JSON.stringify(want)) { fails.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); console.log('  !! MISMATCH', label, JSON.stringify(got)); } else console.log('  ok', label); }
const shotsDir = path.join(__dirname, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'], acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails.push('pageerror ' + e.message); });
  const settle = (ms = 350) => page.waitForTimeout(ms);
  const body = () => page.locator('body').innerText();
  const shot = (name, full = false) => page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: full });
  await page.goto(URL); await page.waitForSelector('text=Start here');
  await page.click('role=button[name="Try the demo team first"]'); await page.waitForURL(/\/practices\//, { timeout: 60000 });

  // Run the demo practice far enough to write two notes, then finish it.
  await page.click('role=button[name="Start practice"]'); await page.waitForURL(/\/live$/); await settle(600);
  for (let i = 0; i < 4 && !/Fundamentals · rotation/i.test(await body()); i++) { await page.getByRole('button', { name: /Next/ }).first().click(); await settle(400); }
  const nameChips = page.locator('.chips').last().locator('.chip');
  const first = (await nameChips.first().innerText()).replace(/ \(\d+\)$/, '');
  await nameChips.first().click(); await page.waitForSelector('.sheet');
  await page.locator('.sheet').getByRole('button', { name: 'Got it' }).click(); await page.waitForSelector('.sheet', { state: 'detached' }); await settle();
  await page.getByRole('button', { name: 'Finish' }).click(); await page.waitForURL(/\/recap$/); await settle();
  await page.getByRole('button', { name: 'Finish practice' }).first().click(); await page.waitForURL(/\/today$/); await settle();

  // Today offers the reports for the practice that just ended.
  await page.getByRole('button', { name: 'Practice reports for families' }).click(); await page.waitForURL(/\/reports$/); await settle();
  let t = await body();
  expect('the send screen is there and says nothing goes out on its own', /Practice reports/.test(t) && /nothing goes out on its own/.test(t), true);
  expect('it asks whether the notes are in and counts them by coach', /Are everyone's notes in\?/.test(t) && /: 1 note\b/.test(await page.locator('[data-notes-in]').innerText()), true);
  expect('nobody is shared yet', /^0 of \d+ shared/m.test(t), true);
  const rows = page.locator('[data-report-kid]');
  const names = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-report-kid')));
  expect('every kid who was there is listed', names.length >= 3 && names.some((n) => n.startsWith(first.split(' ')[0])), true);
  const firstRow = page.locator(`[data-report-kid^="${first.split(' ')[0]}"]`).first();
  expect('his row counts his note', /1 note ·/.test(await firstRow.innerText()), true);
  expect('a kid with a contact shows who it goes to', /to Dana Pike/.test(t), true);
  expect('a kid with no contact says so', /no family contact yet/.test(t), true);
  await shot('40_reports_list', true);

  // Open the kid who got the note.
  await firstRow.click(); await page.waitForSelector('.sheet iframe'); await settle();
  const frame = page.frameLocator('.sheet iframe');
  let doc = await frame.locator('body').innerText();
  const firstName = first.split(' ')[0];
  expect('his report is the program\'s own page', [/practice report/i.test(doc), new RegExp(`for ${firstName}'s family`, 'i').test(doc), await frame.locator('.top').count(), await frame.locator('.hd .wm, .hd .lm').count()], [true, true, 1, 1]);
  expect('the good read is in it as a sentence a parent would say', /Nailed an? [a-z ]+ rep we have been working on\./.test(doc) && !/defense rep|a infield/.test(doc), true);
  expect('it has what he is working on', /working on next/i.test(doc), true);
  expect('it never ranks or compares', /rank|team band|compared/i.test(doc.replace('Nothing here is a ranking.', '')), false);
  // A note from the coach shows up in the preview.
  await page.fill('#report-note', 'He was a lot of fun to coach tonight.'); await settle(250);
  doc = await frame.locator('body').innerText();
  expect('the coach\'s note is in the report', /He was a lot of fun to coach tonight\./.test(doc), true);
  // Take the line out, and it leaves the report.
  const tick = page.locator('[data-report-controls] input[type=checkbox]').first();
  expect('the good read starts ticked', await tick.isChecked(), true);
  await tick.uncheck(); await settle(250);
  expect('unticked, it is out of the report', /Nailed an? .+ rep/.test(await frame.locator('body').innerText()), false);
  await tick.check(); await settle(250);
  expect('ticked again, it is back', /Nailed an? .+ rep/.test(await frame.locator('body').innerText()), true);
  await shot('41_report_sheet');

  // Share as PDF: a browser with no share sheet downloads it.
  await page.waitForSelector('[data-share-pdf]:not([disabled])', { timeout: 20000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-share-pdf]').click()]);
  const pdfPath = path.join(shotsDir, 'practice-report.pdf');
  await dl.saveAs(pdfPath);
  const bytes = fs.readFileSync(pdfPath);
  expect('a real PDF named for the kid and the day', [bytes.slice(0, 5).toString(), bytes.length > 3000, new RegExp(`^${firstName}-.*practice-report-.*\\.pdf$`).test(dl.suggestedFilename())], ['%PDF-', true, true]);
  await settle(500);
  // The sheet moves to the next kid and the list remembers.
  const title = await page.locator('.sheet h2').first().innerText().catch(() => '');
  expect('the sheet moves on to the next kid', title !== `${firstName}'s report` && /'s report$/.test(title), true);
  await page.locator('.sheet').getByRole('button', { name: 'Close' }).click(); await page.waitForSelector('.sheet', { state: 'detached' }); await settle();
  expect('his row says shared and the count moved', [await firstRow.locator('[data-shared]').count(), /^1 of \d+ shared/m.test(await body())], [1, true]);

  // A kid nobody wrote about.
  const other = names.find((n) => !n.startsWith(firstName));
  await page.locator(`[data-report-kid="${other}"]`).click(); await page.waitForSelector('.sheet iframe'); await settle();
  expect('a kid with no notes gets a plain warning for the coach', /Nobody wrote a note on/.test(await page.locator('[data-report-controls]').innerText()), true);
  expect('and a kind line for the family', /did not write notes on .+ at this practice\. That is not a comment on him/.test(await page.frameLocator('.sheet iframe').locator('body').innerText()), true);
  await page.locator('.sheet').getByRole('button', { name: 'Close' }).click(); await page.waitForSelector('.sheet', { state: 'detached' });

  // The recap leads here too, and it survives a reload.
  await page.reload(); await page.waitForSelector('[data-report-kid]'); await settle();
  expect('shared state survives closing the app', await firstRow.locator('[data-shared]').count(), 1);
  await page.getByRole('link', { name: /Recap/ }).click(); await page.waitForURL(/\/recap$/); await settle();
  expect('the recap of a finished practice leads to the reports', await page.getByRole('button', { name: 'Practice reports for families' }).count(), 1);

  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED\n` + fails.join('\n') : '\nALL CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
