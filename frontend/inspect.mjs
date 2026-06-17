import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

// Landing shows when the gate is locked (no backend running locally).
await page.waitForSelector('.thinker-card', { timeout: 10000 }).catch(() => {});

// Scroll the landing's own scroll container to the cards, let animations finish.
await page.evaluate(() => {
  const t = document.querySelector('.thinkers');
  if (t) document.querySelector('.landing').scrollTo(0, Math.max(0, t.offsetTop - 60));
});
await page.waitForTimeout(6000);

const cards = await page.$$eval('.thinker-card', (els) =>
  els.map((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      top: Math.round(r.top),
      left: Math.round(r.left),
      width: Math.round(r.width),
      height: Math.round(r.height),
      transform: cs.transform,
      opacity: cs.opacity,
    };
  })
);
console.log('thinkers container:', await page.$eval('.thinkers', (el) => {
  const cs = getComputedStyle(el);
  return { alignItems: cs.alignItems, display: cs.display, flexWrap: cs.flexWrap };
}));
console.log('CARDS:', JSON.stringify(cards, null, 2));

await page.screenshot({ path: 'inspect-cards.png' });
await browser.close();
