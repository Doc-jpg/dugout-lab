/* House brand walkthrough: a team with no look of its own shows as the Warriors, in light and dark;
   a team with its own look (the demo) is untouched. Run: URL=http://localhost:4174/ node scripts/house-brand.cjs */
const { chromium, devices } = require('playwright');
const path = require('path'); const fs = require('fs');
const URL = process.env.URL || 'http://localhost:4174/';
const fails = [];
function expect(label, got, want) { if (JSON.stringify(got) !== JSON.stringify(want)) { fails.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); console.log('  !! MISMATCH', label, JSON.stringify(got), 'want', JSON.stringify(want)); } else console.log('  ok', label); }
const shotsDir = path.join(__dirname, 'shots'); fs.mkdirSync(shotsDir, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const run = async (scheme) => {
    const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'], colorScheme: scheme });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails.push('pageerror ' + e.message); });
    const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase());
    await page.goto(URL); await page.waitForSelector('text=Start here');
    expect(`${scheme}: before any team the app is already in the house color`, await accent(), scheme === 'dark' ? '#5186b6' : '#0d2241');
    await page.click('role=button[name="Try the demo team first"]'); await page.waitForURL(/\/practices\//, { timeout: 60000 });
    await page.goto(URL + '#/today'); await page.waitForSelector('h1');
    expect(`${scheme}: the demo keeps its own look`, [/Dirtbags Baseball/.test(await page.locator('h1').first().innerText()), /Warriors|Stewards/.test(await page.locator('main').innerText()), await accent() === (scheme === 'dark' ? '#5186b6' : '#0d2241'), await page.locator('main img').first().evaluate((e) => e.naturalWidth === 224).catch(() => false)], [true, false, false, false]);
    // Turn the demo into a plain team with no look of its own, the way a real team starts
    await page.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('dugout-lab'); r.onsuccess = () => { const tx = r.result.transaction('teams', 'readwrite'); const st = tx.objectStore('teams'); const g = st.getAll(); g.onsuccess = () => { for (const t of g.result) { const { brand, ...rest } = t; st.put({ ...rest, name: 'Thirteens', brand: { coaches: [{ name: 'Coach Demo', role: 'Head coach' }] } }); } }; tx.oncomplete = () => { r.result.close(); res(true); }; tx.onerror = () => rej(tx.error); }; }));
    await page.reload(); await page.waitForSelector('h1'); await page.waitForTimeout(400);
    const top = await page.locator('main').innerText();
    expect(`${scheme}: Today shows the house name and tagline`, [(await page.locator('h1').first().innerText()).trim(), /Stewards Sports Guthrie \| Baseball Development/.test(top)], ['Warriors Baseball', true]);
    expect(`${scheme}: the app takes the house color`, await accent(), scheme === 'dark' ? '#5186b6' : '#0d2241');
    const logo = page.locator('main img').first();
    expect(`${scheme}: the W mark is next to the name and really loads`, [(await logo.getAttribute('src')).startsWith('data:image/png;base64,'), await logo.evaluate((e) => e.complete && e.naturalWidth)], [true, 224]);
    const btn = await page.locator('.btn.primary').first().evaluate((e) => { const s = getComputedStyle(e); return [s.backgroundColor, s.color]; });
    expect(`${scheme}: a main button is readable`, btn, scheme === 'dark' ? ['rgb(81, 134, 182)', 'rgb(17, 17, 17)'] : ['rgb(13, 34, 65)', 'rgb(255, 255, 255)']);
    await page.screenshot({ path: path.join(shotsDir, `50_house_today_${scheme}.png`) });
    // A parent page carries it too
    await page.goto(URL + '#/players/demo-p04'); await page.waitForSelector('h1');
    await page.getByRole('button', { name: 'Family', exact: true }).click(); await page.waitForTimeout(300);
    await page.locator('[data-progress-card="family"]').getByRole('button', { name: 'Progress page' }).click(); await page.waitForSelector('.sheet iframe');
    const doc = await page.frameLocator('.sheet iframe').locator('body').innerText();
    expect(`${scheme}: the parent page is headed and footed by the house brand, with the listed coach`, [/^\s*Warriors Baseball\s*\n\s*Stewards Sports Guthrie \| Baseball Development/.test(doc), /Warriors • Stewards Sports Guthrie/.test(doc), /Coaches: Coach Demo \(Head coach\)/.test(doc), /Dirtbags/.test(doc)], [true, true, true, false]);
    expect(`${scheme}: the parent page carries the W mark`, await page.frameLocator('.sheet iframe').locator('.brandbar img').evaluate((e) => e.complete && e.naturalWidth), 224);
    const rule = await page.frameLocator('.sheet iframe').locator('.brandbar').evaluate((e) => getComputedStyle(e).borderBottomColor);
    expect(`${scheme}: the rule under the page's heading is navy`, rule, 'rgb(13, 34, 65)');
    if (scheme === 'light') fs.writeFileSync(path.join(shotsDir, 'house-progress-page.html'), await page.locator('.sheet iframe').getAttribute('srcdoc'));
    await page.locator('.sheet-head >> role=button[name="Close"]').click(); await page.waitForSelector('.sheet', { state: 'detached' });
    // Settings says what is showing, and Branding opens pre-filled so adding a logo keeps the rest
    await page.goto(URL + '#/settings'); await page.waitForSelector('text=Other coaches');
    expect(`${scheme}: Settings says it shows as the Warriors`, /Shows as "Warriors Baseball" in the app's own navy and blue/.test(await page.locator('main').innerText()), true);
    await page.getByRole('button', { name: /Branding: name, logo, colors, coaches/ }).click(); await page.waitForSelector('.sheet');
    const vals = await page.locator('.sheet input').evaluateAll((els) => els.map((e) => e.value));
    expect(`${scheme}: the Branding sheet starts from the house look`, [vals.includes('Warriors Baseball'), vals.includes('#0D2241'), vals.includes('#286AA5'), vals.includes('Stewards Sports Guthrie | Baseball Development')], [true, true, true, true]);
    await ctx.close();
  };
  await run('light'); await run('dark');
  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED\n` + fails.join('\n') : '\nALL CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
