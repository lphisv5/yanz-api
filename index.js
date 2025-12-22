const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createPool } = require('generic-pool');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());

app.set('trust proxy', 1); // แก้ error Render

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // หลวมสำหรับฟรี public
  message: { error: 'Too many requests!' }
});
app.use(limiter);

// Browser Pool
const browserFactory = {
  create: async () => {
    return await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote']
    });
  },
  destroy: async (browser) => await browser.close()
};

const pool = createPool(browserFactory, { max: 3, min: 1 });

// === Bypass Self-Hosted Ultimate (เร็วสุด 8-15 วินาที) ===
async function bypassLinkvertiseSelf(url) {
  const browser = await pool.acquire();
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) req.abort();
      else req.continue();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });

    const html = await page.content();
    if (/captcha|cloudflare|verify you are human/i.test(html)) {
      return { success: false, error: 'Blocked by protection - try later or different IP' };
    }

    const xp = "//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'get link') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'access')] | //button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'get link')]";

    let clicked = 0;
    while (clicked < 2) {
      try {
        await page.waitForXPath(xp, { timeout: 12000 });
        const [btn] = await page.$x(xp);
        if (btn) {
          await btn.click();
          clicked++;
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
            page.waitForTimeout(15000)
          ]);
        }
      } catch (e) {
        break;
      }
    }

    const finalUrl = page.url();
    const content = await page.evaluate(() => document.body.innerText.substring(0, 800));

    return { success: true, destination: finalUrl, content: content.trim() };

  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    await page.close();
    pool.release(browser);
  }
}

// Endpoint
app.get('/bypass', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.toLowerCase().includes('linkvertise.com')) {
    return res.status(400).json({ error: 'Only Linkvertise links!' });
  }

  const result = await bypassLinkvertiseSelf(url);
  res.json(result);
});

app.get('/', (req, res) => {
  res.send('<h1>Linkvertise Bypass API - SELF-HOSTED ULTIMATE 2025</h1><p>/bypass?url=...</p><p>8-15s • No external • Public Free</p>');
});

app.listen(PORT, () => {
  console.log(`Self-Hosted API running on port ${PORT}`);
});
