/* Two phones through the live sync server: the head coach starts a tryout, a linked coach's phone
   gets it, both score blind, the board on each phone shows both. Uses the demo team and made-up kids;
   it leaves a throwaway team's rows on the server like the other live checks.
   Run: URL=http://localhost:4174/ node scripts/tryout-live.cjs */
const { chromium, devices } = require('playwright');
const URL = process.env.URL || 'http://localhost:4174/';
const fails = [];
function expect(label, got, want) { if (JSON.stringify(got) !== JSON.stringify(want)) { fails.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); console.log('  !! MISMATCH', label, JSON.stringify(got), 'want', JSON.stringify(want)); } else console.log('  ok', label); }
(async () => {
  const browser = await chromium.launch();
  const dev = devices[process.env.DEVICE || 'iPhone 13'];
  const A = await (await browser.newContext({ ...dev })).newPage();
  for (const p of [A]) p.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails.push('pageerror ' + e.message); });
  const waitFor = async (pg, re, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await pg.locator('body').innerText())) return true; await pg.waitForTimeout(700); } return false; };
  const setCoach = (page, name) => page.evaluate((n) => new Promise((res, rej) => { const r = indexedDB.open('dugout-lab'); r.onsuccess = () => { const tx = r.result.transaction('settings', 'readwrite'); const st = tx.objectStore('settings'); const g = st.get('settings'); g.onsuccess = () => { st.put({ ...(g.result || { id: 'settings' }), coachName: n }); }; tx.oncomplete = () => { r.result.close(); res(true); }; tx.onerror = () => rej(tx.error); }; r.onerror = () => rej(r.error); }), name);
  const tscore = (page, kid) => page.locator(`.tscore[data-kid="${kid}"]`);
  const tab = (page, name) => page.locator('[data-tryout] > .chips').first().getByRole('button', { name });
  const cells = async (page, kid) => (await page.locator(`tr[data-board-kid="${kid}"] td`).allInnerTexts()).map((s) => s.trim());

  await A.goto(URL); await A.waitForSelector('text=Start here');
  await A.click('role=button[name="Try the demo team first"]'); await A.waitForURL(/\/practices\//, { timeout: 60000 });
  await setCoach(A, 'Deren'); await A.reload();
  await A.goto(URL + '#/settings'); await A.waitForSelector('text=Other coaches');
  await A.getByRole('button', { name: /Turn on linked phones/ }).click();
  expect('head phone: linked phones on', await waitFor(A, /linked phones on/), true);
  await A.getByRole('button', { name: '+ Invite a coach' }).click(); await A.waitForSelector('text=Invite a coach');
  await A.fill('.sheet input', 'Aaron');
  await A.locator('.sheet').getByRole('button', { name: 'Assistant', exact: true }).first().click();
  await A.locator('.sheet').getByRole('button', { name: 'Make the invite' }).click(); await A.waitForSelector('text=Invite for Aaron');
  const link = (await A.locator('.sheet pre').innerText()).trim();
  await A.locator('.sheet').getByRole('button', { name: 'Done' }).click();

  // The other coach is already linked and opens Tryouts before the head coach has started one
  const B = await (await browser.newContext({ ...dev })).newPage();
  B.on('pageerror', (e) => { console.log('PAGEERROR B', e.message); fails.push('pageerror B ' + e.message); });
  await B.goto(link.replace(/^https?:\/\/[^#]+/, URL)); await B.waitForSelector('text=Set up this phone as Aaron');
  await B.getByRole('button', { name: 'Set up this phone as Aaron' }).click();
  expect("second phone set itself up", await waitFor(B, /All set/, 40000), true);
  await B.goto(URL + '#/today'); await B.waitForSelector('h1');
  await B.getByRole('button', { name: 'Tryouts', exact: true }).click();
  expect('second phone is told to wait, not to start its own', [await waitFor(B, /Waiting for the head coach's tryout/i, 8000), await B.getByRole('button', { name: 'Start', exact: true }).count()], [true, 0]);

  // The head coach starts the tryout
  await A.goto(URL + '#/tryouts'); await A.waitForSelector('text=Start a tryout');
  await A.getByRole('button', { name: 'Start', exact: true }).click(); await A.waitForSelector('[data-tryout]');
  expect('head phone scores under the linked name', /Scoring as Deren/.test(await A.locator('[data-tryout]').innerText()), true);
  await A.getByRole('button', { name: '+ Add a kid' }).first().click(); await A.waitForSelector('#kid-name');
  await A.fill('#kid-name', 'Alex Rivers'); await A.fill('#kid-num', '12'); await A.locator('.sheet-foot >> role=button[name="Save"]').click(); await A.waitForSelector('.sheet', { state: 'detached' });
  await A.locator('.chips[aria-label="Station"]').getByRole('button', { name: 'Ground balls' }).click();
  await tscore(A, 'Alex Rivers').locator('.tnums button').nth(4).click();
  await A.waitForTimeout(4000); // sync fires two seconds after a change

  await B.getByRole('button', { name: 'Check now' }).click();
  expect('one tap and the second phone is in the tryout with the kid on it', await waitFor(B, /Scoring as Aaron[\s\S]*#12 Alex Rivers/), true);
  await B.locator('.chips[aria-label="Station"]').getByRole('button', { name: 'Ground balls' }).click(); await B.waitForTimeout(300);
  expect('second phone sees none of the first coach\'s marks while scoring', await B.locator('.tnums button.on').count(), 0);
  await tscore(B, 'Alex Rivers').locator('.tnums button').nth(1).click();
  await tscore(B, 'Alex Rivers').getByRole('button', { name: /Note/ }).click(); await tscore(B, 'Alex Rivers').locator('input').fill('Late to the ball'); await tscore(B, 'Alex Rivers').locator('input').blur();
  // a walk-up and a new station from the second phone
  await B.getByRole('button', { name: '+ Add a kid' }).click(); await B.waitForSelector('#kid-name');
  await B.fill('#kid-name', 'Ben Cole'); await B.locator('.sheet-foot >> role=button[name="Save"]').click(); await B.waitForSelector('.sheet', { state: 'detached' });
  await tab(B, /Kids and stations/).click(); await B.waitForTimeout(300);
  await B.getByLabel('New station').fill('Bunting'); await B.getByRole('button', { name: 'Add', exact: true }).click();
  await B.waitForTimeout(4500);

  // Back on the head phone: opening the app syncs
  await A.reload(); await A.waitForSelector('[data-tryout]');
  expect('head phone got the walk-up', await waitFor(A, /Kids and stations \(2\)/), true);
  await tab(A, 'Board').click();
  expect('head board names both coaches', await waitFor(A, /Scored by Aaron \(1\), Deren \(1\)\./), true);
  const row = await cells(A, 'Alex Rivers');
  const heads = (await A.locator('table.tboard th').allInnerTexts()).map((s) => s.trim());
  expect('head board averages the two phones and flags them as apart', [row[heads.indexOf('Ground')], await A.locator('tr[data-board-kid="Alex Rivers"] td.split').count()], ['3.5', 1]);
  expect('the station added on the other phone is a column here', heads.includes('Bunting'), true);
  await A.locator('tr[data-board-kid="Alex Rivers"]').click(); await A.waitForSelector('.sheet');
  expect('each coach and the other phone\'s note are on the kid sheet', /Aaron 2\.0 · Deren 5\.0 · coaches apart/.test(await A.locator('.sheet').innerText()) && /Aaron, Ground balls.*: Late to the ball/.test(await A.locator('.sheet').innerText()), true);
  await A.getByRole('group', { name: 'Decision' }).getByRole('button', { name: 'Waitlist' }).click();
  await A.locator('.sheet-foot >> role=button[name="Done"]').click();
  await A.waitForTimeout(4500);
  await B.reload(); await B.waitForSelector('[data-tryout]');
  await tab(B, 'Board').click();
  expect('second phone board shows both coaches and the decision', await waitFor(B, /Scored by Aaron \(1\), Deren \(1\)\.[\s\S]*Waitlist/), true);
  expect('second phone cannot delete the tryout', (await (async () => { await tab(B, /Kids and stations/).click(); await B.waitForTimeout(300); return B.getByRole('button', { name: 'Delete this tryout' }).count(); })()), 0);

  // Offline: marks are kept and go out when the signal is back
  await B.context().setOffline(true);
  await tab(B, 'Score').click(); await B.waitForTimeout(300);
  await B.locator('.chips[aria-label="Station"]').getByRole('button', { name: 'Hitting' }).click();
  await tscore(B, 'Alex Rivers').locator('.tnums button').nth(3).click(); await B.waitForTimeout(500);
  await B.reload().catch(() => undefined); await B.waitForSelector('[data-tryout]');
  await B.locator('.chips[aria-label="Station"]').getByRole('button', { name: 'Hitting' }).click(); await B.waitForTimeout(300);
  expect('a mark made with no signal is still there after reopening with no signal', (await tscore(B, 'Alex Rivers').locator('.tnums button.on .n').allInnerTexts()).join(''), '4');
  await B.context().setOffline(false);
  await B.reload(); await B.waitForSelector('[data-tryout]'); await B.waitForTimeout(4000);
  await A.reload(); await A.waitForSelector('[data-tryout]'); await tab(A, 'Board').click();
  expect('it reaches the head phone once the signal is back', await waitFor(A, /Scored by Aaron \(2\), Deren \(1\)\./), true);

  // Clean up: the head coach deletes the tryout and it leaves the other phone too
  await tab(A, /Kids and stations/).click(); await A.waitForTimeout(300);
  await A.getByRole('button', { name: 'Delete this tryout' }).click();
  await A.getByRole('button', { name: 'Yes, delete all of it' }).click(); await A.waitForURL(/#\/today/);
  await A.getByRole('button', { name: 'Tryouts', exact: true }).click();
  expect('after deleting, Tryouts offers a fresh start', await waitFor(A, /Start a tryout/i, 8000), true);
  await A.waitForTimeout(4500);
  await B.reload();
  expect('deleting on the head phone removes it from the other phone', await waitFor(B, /That tryout is not on this phone/), true);
  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED\n` + fails.join('\n') : '\nALL CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
