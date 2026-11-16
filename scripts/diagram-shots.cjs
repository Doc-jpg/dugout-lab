// Screenshot every gallery page. Run: node scripts/diagram-shots.cjs <dir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const dir = process.argv[2]; const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: process.argv[3] === 'steps' ? 1580 : 1190, height: 900 }, deviceScaleFactor: 1 });
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
    await pg.goto('file://' + path.resolve(dir, f));
    await pg.screenshot({ path: path.join(dir, f.replace('.html', '.png')), fullPage: true });
  }
  await b.close();
})();
