/* Branding walkthrough: program name, logo upload, palette, eyedropper, colors applied, branded scorecard. */
const { chromium, devices } = require('playwright');
const path = require('path');
const URL = process.env.URL || 'http://localhost:4174/';
const fails = [];
function expect(label, got, want) { if (JSON.stringify(got) !== JSON.stringify(want)) { fails.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); console.log('  !! MISMATCH', label, JSON.stringify(got), 'want', JSON.stringify(want)); } else console.log('  ok', label); }
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails.push('pageerror ' + e.message); });
  await page.goto(URL); await page.waitForSelector('text=Start here');
  await page.click('role=button[name="Try the demo team first"]'); await page.waitForURL(/\/practices\//, { timeout: 60000 });
  await page.goto(URL + '#/today'); await page.waitForSelector('h1');
  expect('demo brand name in header', await page.locator('h1').first().innerText(), 'Dirtbags Baseball DEMO (fictional)');
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  expect('demo primary applied to the app', accent, '#8a3b12');
  // Rebrand: new name, upload a logo, auto-pick colors
  await page.goto(URL + '#/settings'); await page.waitForSelector('text=Branding');
  await page.click('role=button[name=/Branding: name/]'); await page.waitForSelector('.sheet');
  await page.fill('.sheet input[placeholder="Dirtbags DEMO (fictional)"]', 'Wow Factor 2032');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('role=button[name="Replace logo"]')]);
  await chooser.setFiles(path.join(__dirname, 'shots', 'test-logo.png'));
  await page.waitForTimeout(600);
  const swatches = await page.locator('.sheet .row.wrap .btn.sm[title*="of the logo"]').allInnerTexts();
  expect('palette found from the uploaded logo', swatches.length >= 2, true);
  console.log('  palette:', swatches.join(' '));
  await page.click('role=button[name="Auto-pick from logo"]');
  await page.waitForTimeout(200);
  const primary = await page.locator('.sheet input[placeholder="#1d4e89"]').inputValue();
  const accent2 = await page.locator('.sheet input[placeholder="#f0963c"]').inputValue();
  expect('auto-pick set primary to the green', /^#1[0-9a-f]5[0-9a-f]3[0-9a-f]$/i.test(primary) || /^#1/.test(primary), true);
  expect('auto-pick set accent to the orange', /^#[ef][0-9a-f]9[0-9a-f][0-9a-f]{2}$/i.test(accent2) || /^#[ef]/.test(accent2), true);
  console.log('  colors:', primary, accent2);
  // Eyedropper: click the center of the canvas (orange circle) with "accent" selected
  await page.click('role=button[name="Picking accent"]');
  const canvas = page.locator('.sheet canvas');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
  const picked = await page.locator('.sheet input[placeholder="#f0963c"]').inputValue();
  expect('eyedropper picked the orange center', /^#f0962[0-9a-f]$|^#f09628$/i.test(picked) || /^#[ef]/.test(picked), true);
  console.log('  eyedropper:', picked);
  // Coach contact
  await page.locator('.sheet input[placeholder="Head coach"]').first().fill('Head coach');
  await page.locator('.sheet-foot >> role=button[name="Save"]').click();
  await page.waitForSelector('.sheet', { state: 'detached' });
  await page.waitForTimeout(300);
  const accent3 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  expect('app recolored after save', accent3 !== '#8a3b12' && accent3 !== '', true);
  await page.goto(URL + '#/today'); await page.waitForSelector('h1');
  expect('new program name in header', await page.locator('h1').first().innerText(), 'Wow Factor 2032');
  expect('logo in header', await page.locator('h1').locator('xpath=../..').locator('img').count(), 1);
  await page.screenshot({ path: path.join(__dirname, 'shots', '12_branded_today.png') });
  // Branded scorecard
  await page.goto(URL + '#/players'); await page.waitForSelector('text=Jonah'); await page.click('text=Jonah'); await page.waitForSelector('text=Try next');
  await page.getByRole('button', { name: 'Family' }).click(); await page.waitForTimeout(300);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Scorecard', exact: true }).click()]);
  await popup.waitForLoadState();
  const card = await popup.locator('body').innerText();
  expect('scorecard carries program name', /Wow Factor 2032/.test(card), true);
  expect('scorecard lists coaches', /Coaches: .*Coach Demo \(Head coach\) 555-0100/.test(card), true);
  expect('scorecard has the logo', await popup.locator('.brandbar img').count(), 1);
  await popup.screenshot({ path: path.join(__dirname, 'shots', '13_branded_scorecard.png'), fullPage: true });
  await popup.close();
  console.log(fails.length ? `FAILURES (${fails.length}):\n - ` + fails.join('\n - ') : 'ALL CHECKS PASSED');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e.message.split('\n')[0]); console.log(fails); process.exit(1); });
