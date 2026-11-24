/* Tryout walkthrough: start one, paste kids, change stations, two coaches score blind, the board adds up.
   All names here are made up. Run: URL=http://localhost:4174/ node scripts/tryout.cjs   (DEVICE="Pixel 5" for Android) */
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
  const settle = (ms = 300) => page.waitForTimeout(ms);
  const shot = (name, full = false) => page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: full });
  const setCoach = (name) => page.evaluate((n) => new Promise((res, rej) => { const r = indexedDB.open('dugout-lab'); r.onsuccess = () => { const tx = r.result.transaction('settings', 'readwrite'); const st = tx.objectStore('settings'); const g = st.get('settings'); g.onsuccess = () => { st.put({ ...(g.result || { id: 'settings' }), coachName: n }); }; tx.oncomplete = () => { r.result.close(); res(true); }; tx.onerror = () => rej(tx.error); }; r.onerror = () => rej(r.error); }), name);
  const tab = (name) => page.locator('[data-tryout] > .chips').first().getByRole('button', { name });
  const tscore = (kid) => page.locator(`.tscore[data-kid="${kid}"]`);
  const pressed = async (kid) => (await tscore(kid).locator('.tnums button.on .n').allInnerTexts()).join('');

  await page.goto(URL); await page.waitForSelector('text=Start here');
  await page.click('role=button[name="Try the demo team first"]'); await page.waitForURL(/\/practices\//, { timeout: 60000 });
  await setCoach('Deren');
  await page.goto(URL + '#/today'); await page.waitForSelector('h1');
  await page.getByRole('button', { name: 'Tryouts', exact: true }).click(); await page.waitForSelector('text=Start a tryout');
  expect('start screen says coaches only and lists the stations', /For coaches only/.test(await page.locator('main').innerText()) && /catch play, ground balls, fly balls, pitching, catching, hitting/.test(await page.locator('main').innerText()), true);
  await page.fill('#try-name', 'Fall tryouts');
  await page.getByRole('button', { name: 'Start', exact: true }).click(); await page.waitForSelector('[data-tryout]');
  expect('opens on the scoring tab as this coach', /Scoring as Deren/.test(await page.locator('[data-tryout]').innerText()), true);
  expect('no kids yet offers both ways in', (await page.getByRole('button', { name: '+ Add a kid' }).count()) >= 1 && (await page.getByRole('button', { name: 'Paste a list' }).count()) === 1, true);

  // Kids: paste the sign-up list, then a walk-up
  await page.getByRole('button', { name: 'Paste a list' }).click(); await settle();
  await page.getByRole('button', { name: 'Paste a list' }).click(); await page.waitForSelector('.sheet textarea');
  await page.fill('.sheet textarea', 'Alex Rivers, RHP / OF, Storm 13u\nBen Cole, 3B / P, Hawks 12u\nCy Dunn, CF / C, Velo\nDrew Park, OF / 1B, Cats\nEli Stone, 2B / 3B, Performance\nAlex Rivers, dup');
  expect('the list is read and the repeat is dropped', await page.locator('.sheet-foot').innerText(), 'Add 5');
  expect('preview shows positions and team', /Cy Dunn: CF \/ C · Velo/.test(await page.locator('.sheet').innerText()), true);
  await page.locator('.sheet-foot >> role=button[name="Add 5"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
  await page.getByRole('button', { name: '+ Add a kid' }).click(); await page.waitForSelector('#kid-name');
  await page.fill('#kid-name', 'Finn Walker'); await page.fill('#kid-num', '9'); await page.fill('#kid-pos', 'P / LF'); await page.fill('#kid-wear', 'bright green shirt');
  expect('the add sheet says what stays on the sign-up sheet', /No birthdays, parents or phone numbers here/.test(await page.locator('.sheet').innerText()), true);
  await page.locator('.sheet-foot >> role=button[name="Save"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
  expect('six kids, the numbered one first', /Kids and stations \(6\)/.test(await page.locator('[data-tryout]').innerText()) && (await page.locator('.card').first().locator('.item .title').first().innerText()) === '#9 Finn Walker', true);

  // Stations on the fly: add one, rename one, hide one
  await page.getByLabel('New station').fill('Bunting'); await page.getByRole('button', { name: 'Add', exact: true }).click(); await settle();
  const first = page.getByLabel('Station 1 name'); await first.fill('Throwing'); await first.blur(); await settle();
  await page.locator('.item', { has: page.locator('input[value="Catching"]') }).getByRole('button', { name: 'Hide' }).click(); await settle();
  expect('nine stations, one hidden', [await page.locator('input[aria-label^="Station "]').count(), await page.getByRole('button', { name: 'Show', exact: true }).count()], [9, 1]);
  await shot('40_tryout_setup', true);

  // Deren scores a station for every kid
  await tab('Score').click(); await settle();
  const stationChips = await page.locator('.chips[aria-label="Station"] .chip').allInnerTexts();
  expect('scoring shows the renamed and new stations and not the hidden one', stationChips, ['Throwing', 'Ground balls', 'Fly balls', 'Pitching', 'Hitting', 'Speed and athleticism', 'Coachability and effort', 'Bunting']);
  expect('two nights to pick from, tonight picked', [await page.locator('.chips[aria-label="Night"] .chip').count(), await page.locator('.chips[aria-label="Night"] .chip.on').count()], [2, 1]);
  await page.locator('.chips[aria-label="Station"]').getByRole('button', { name: 'Ground balls' }).click(); await settle(150);
  const gb = { 'Finn Walker': 5, 'Alex Rivers': 4, 'Ben Cole': 2, 'Cy Dunn': 3 };
  for (const [kid, v] of Object.entries(gb)) await tscore(kid).locator('.tnums button').nth(v - 1).click();
  await settle();
  const key = await page.locator('[data-scale-key]').innerText();
  expect('the scale is spelled out at the top without tapping anything', /5 is best\. 1 is lowest\./.test(key) && /A 3 is about our average player/.test(key) && /A blank is not held against him/.test(key), true);
  expect('every row of buttons says which end is which', (await tscore('Drew Park').locator('.tnums button').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()), ['1 lowest', '2', '3 average', '4', '5 best']);
  expect('a picked 5 turns green and a picked 2 turns orange', [await tscore('Finn Walker').locator('.tnums button.on').evaluate((e) => getComputedStyle(e).backgroundColor), await tscore('Ben Cole').locator('.tnums button.on').evaluate((e) => getComputedStyle(e).backgroundColor)], ['rgb(27, 127, 74)', 'rgb(201, 119, 43)']);
  await page.getByRole('button', { name: 'See what each number means' }).click(); await settle(150);
  expect('the five meanings, best first', (await page.locator('.tkey-list li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()), ['5 One of our best', '4 Above our average', '3 About our average player', '2 Below our average', '1 Well below our team']);
  await page.getByRole('button', { name: 'Hide the five' }).click();
  expect('taps stick', [await pressed('Finn Walker'), await pressed('Ben Cole'), await pressed('Drew Park')], ['5', '2', '']);
  await tscore('Ben Cole').locator('.tnums button').nth(1).click(); await settle(150);
  expect('tapping the same number clears it', await pressed('Ben Cole'), '');
  await tscore('Ben Cole').locator('.tnums button').nth(1).click();
  await tscore('Ben Cole').getByRole('button', { name: /Note/ }).click(); await tscore('Ben Cole').locator('input').fill('Sits back on everything'); await tscore('Ben Cole').locator('input').blur(); await settle(400);
  expect('a note saves and shows', /Note ✓/.test(await tscore('Ben Cole').innerText()), true);
  // What a kid is wearing, so a coach who does not know names can find him
  expect('the walk-up shows what he has on; the others invite it', [await tscore('Finn Walker').locator('.wear').innerText(), await tscore('Alex Rivers').locator('.wear').innerText()], ['bright green shirt', '+ what he is wearing']);
  await tscore('Alex Rivers').locator('.wear').click(); await page.waitForSelector('#kid-wear');
  expect('the sheet asks about tonight by name', /What he is wearing, \w{3}, \w{3} \d+/.test(await page.locator('.sheet').innerText()), true);
  await page.fill('#kid-wear', 'red hoodie, white cleats'); await page.locator('.sheet-foot >> role=button[name="Save"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
  expect('set from the scoring screen in one sheet', await tscore('Alex Rivers').locator('.wear').innerText(), 'red hoodie, white cleats');
  expect('his mark is untouched by the edit', await pressed('Alex Rivers'), '4');
  await shot('41_tryout_score_station');

  // One kid, every station, with a lean and an overall note
  await page.getByRole('button', { name: 'One kid, every station' }).click(); await settle();
  await page.locator('.chips[aria-label="Kid"]').getByRole('button', { name: /Alex Rivers/ }).click(); await settle(150);
  expect('his chip counts what is done', /Alex Rivers 1\/8/.test(await page.locator('.chips[aria-label="Kid"] .chip.on').innerText()), true);
  const stRow = (label) => page.locator('.tscore', { has: page.locator('.title', { hasText: new RegExp(`^${label}$`) }) });
  await stRow('Hitting').locator('.tnums button').nth(4).click();
  await stRow('Pitching').locator('.tnums button').nth(3).click();
  await page.getByRole('group', { name: 'Lean on Alex Rivers' }).getByRole('button', { name: 'Yes' }).click();
  await page.getByLabel('Anything else about Alex').fill('Loud contact, good teammate'); await page.getByLabel('Anything else about Alex').blur(); await settle(400);
  expect('three stations done and the lean is set', [/Alex Rivers 3\/8/.test(await page.locator('.chips[aria-label="Kid"] .chip.on').innerText()), await page.getByRole('group', { name: 'Lean on Alex Rivers' }).locator('.chip.on').innerText()], [true, 'Yes']);
  await shot('42_tryout_score_kid', true);

  // A second coach on the same list: he sees none of Deren's marks while scoring
  await setCoach('Aaron'); await page.reload(); await page.waitForSelector('[data-tryout]');
  expect('now scoring as the second coach', /Scoring as Aaron/.test(await page.locator('[data-tryout]').innerText()), true);
  await page.locator('.chips[aria-label="Station"]').getByRole('button', { name: 'Ground balls' }).click(); await settle(150);
  expect('scoring is blind: nothing of the other coach shows', [await page.locator('.tnums button.on').count(), /Sits back/.test(await page.locator('[data-tryout]').innerText())], [0, false]);
  for (const [kid, v] of Object.entries({ 'Finn Walker': 2, 'Alex Rivers': 5, 'Ben Cole': 2 })) await tscore(kid).locator('.tnums button').nth(v - 1).click();
  await page.getByRole('button', { name: 'One kid, every station' }).click(); await settle();
  await page.locator('.chips[aria-label="Kid"]').getByRole('button', { name: /Alex Rivers/ }).click(); await settle(150);
  await page.getByRole('group', { name: 'Lean on Alex Rivers' }).getByRole('button', { name: 'Maybe' }).click(); await settle();

  // The board
  await tab('Board').click(); await settle();
  const board = await page.locator('[data-tryout]').innerText();
  expect('board says coaches only', /Coaches only\./.test(board), true);
  expect('board says which way is good', /Higher is better\./i.test(board) && /5 is best\. 1 is lowest\. 3 is about our average player\./.test(board), true);
  expect('board names who scored', /Scored by Aaron \(4\), Deren \(8\)\./.test(board), true);
  const cellsOf = async (kid) => (await page.locator(`tr[data-board-kid="${kid}"] td`).allInnerTexts()).map((s) => s.trim());
  const heads = (await page.locator('table.tboard th').allInnerTexts()).map((s) => s.trim());
  expect('board columns follow the stations', heads, ['Kid', 'Overall', 'Throwing', 'Ground', 'Fly balls', 'Pitching', 'Hitting', 'Speed', 'Coachability', 'Bunting', 'Y / M / N']);
  const alex = await cellsOf('Alex Rivers');
  expect('Alex: ground balls is the two coaches averaged, overall is his three stations', [alex[3], alex[5], alex[6], alex[1], alex[10]], ['4.5', '4.0', '5.0', '4.5', '1 / 1 / 0']);
  const finn = await cellsOf('Finn Walker');
  expect('Finn: 5 and 2 average to 3.5 and are flagged as apart', [finn[3], await page.locator('tr[data-board-kid="Finn Walker"] td.split').count(), await page.locator('tr[data-board-kid="Alex Rivers"] td.split').count()], ['3.5', 1, 0]);
  expect('a kid nobody scored shows dashes and sorts last', [(await cellsOf('Eli Stone'))[1], await page.locator('table.tboard tbody tr').last().getAttribute('data-board-kid')], ['–', 'Eli Stone']);
  expect('best overall is on top', await page.locator('table.tboard tbody tr').first().getAttribute('data-board-kid'), 'Alex Rivers');
  await shot('43_tryout_board');
  await page.locator('tr[data-board-kid="Finn Walker"]').click(); await page.waitForSelector('.sheet');
  let sheet = await page.locator('.sheet').innerText();
  expect('kid sheet shows each coach and says they are apart', /Ground balls\s*Aaron 2\.0 · Deren 5\.0 · coaches apart/.test(sheet), true);
  await page.locator('.sheet-foot >> role=button[name="Done"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
  await page.locator('tr[data-board-kid="Alex Rivers"]').click(); await page.waitForSelector('.sheet');
  sheet = await page.locator('.sheet').innerText();
  expect('the kid sheet on the board shows what he wore', /red hoodie, white cleats/.test(sheet), true);
  expect('leans and notes carry the coach', /Yes: Deren · Maybe: Aaron · No: nobody/.test(sheet) && /Deren, Overall, .+: Loud contact, good teammate/.test(sheet), true);
  await page.getByRole('group', { name: 'Decision' }).getByRole('button', { name: 'Offer' }).click(); await settle();
  await page.locator('.sheet-foot >> role=button[name="Done"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
  expect('the decision shows on the board', /Offer/.test((await cellsOf('Alex Rivers'))[0]), true);
  await page.selectOption('#board-sort', { label: 'Name' }); await settle(150);
  expect('order by name', await page.locator('table.tboard tbody tr').first().getAttribute('data-board-kid'), 'Alex Rivers');
  await page.getByRole('button', { name: 'Print or share the board' }).click(); await page.waitForSelector('.sheet iframe');
  const doc = await page.frameLocator('.sheet iframe').locator('body').innerText();
  expect('printed board says coaches only and carries the notes', /For coaches only\./.test(doc) && /5 is best\. 1 is lowest\./.test(doc) && /Sits back on everything/.test(doc) && /Ground balls\s+2\.0\s+5\.0\s+3\.5/.test(doc) && /Wearing: bright green shirt/.test(doc), true);
  expect('the report leaves out the kid nobody marked and the stations nobody ran, and says so', [/Eli Stone/.test(doc), /Fly balls\t/.test(doc), /Stations nobody scored, left out: .*Fly balls/.test(doc), /kids? on the list had no marks/.test(doc)], [false, false, true, true]);
  expect('each note sits under its kid and its coach', /Ben Cole[\s\S]*What the coaches wrote\s+Deren\s+Ground balls: Sits back on everything[\s\S]*Cy Dunn/.test(doc), true);
  expect('printed board carries the team header and prints sideways', [await page.frameLocator('.sheet iframe').locator('.brandbar .n').count(), /@page\{size:(landscape|portrait)/.test(await page.locator('.sheet iframe').getAttribute('srcdoc'))], [1, true]);
  fs.writeFileSync(path.join(shotsDir, 'tryout-board.html'), await page.locator('.sheet iframe').getAttribute('srcdoc'));
  await page.locator('.sheet-head >> role=button[name="Close"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });

  // Night two is its own set of marks; the board can show one night or both
  await tab('Score').click(); await settle();
  await page.locator('.chips[aria-label="Night"] .chip').nth(1).click(); await settle(150);
  await page.locator('.chips[aria-label="Station"]').getByRole('button', { name: 'Ground balls' }).click(); await settle(150);
  expect('night two starts blank', await page.locator('.tnums button.on').count(), 0);
  expect('last week\'s clothes are not shown as tonight\'s', await tscore('Finn Walker').locator('.wear').innerText(), '+ what he is wearing');
  await tscore('Finn Walker').locator('.tnums button').nth(3).click(); await settle();
  await tab('Board').click(); await settle();
  expect('both nights: Aaron counts once (2 and 4 make 3), with Deren 5 that is 4.0', (await cellsOf('Finn Walker'))[3], '4.0');
  await page.locator('.chips[aria-label="Which night"] .chip').nth(2).click(); await settle(150);
  expect('night two alone', (await cellsOf('Finn Walker'))[3], '4.0');
  await page.locator('.chips[aria-label="Which night"] .chip').nth(1).click(); await settle(150);
  expect('night one alone', (await cellsOf('Finn Walker'))[3], '3.5');

  // Taking a kid off the list, and the tryout survives a reload
  await tab(/Kids and stations/).click(); await settle();
  await page.locator('.item.tappable', { hasText: 'Eli Stone' }).click(); await page.waitForSelector('#kid-name');
  await page.locator('.sheet-foot >> role=button[name="Take him off the list"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
  await page.reload(); await page.waitForSelector('[data-tryout]');
  expect('five kids left after a reload, and Today leads straight back in', /Kids and stations \(5\)/.test(await page.locator('[data-tryout]').innerText()), true);

  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED\n` + fails.join('\n') : '\nALL CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
