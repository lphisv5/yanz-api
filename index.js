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

app.set('trust proxy', true); // หรือ app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, wait a minute.' }
});
app.use(limiter);

const browserFactory = {
  create: async () => {
    return await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote'
      ]
    });
  },
  destroy: async (browser) => await browser.close()
};

const pool = createPool(browserFactory, { max: 3, min: 1, idleTimeoutMillis: 300000 });

// === Bypass Linkvertise FAST (6-12 วินาที) ===
async function bypassLinkvertise(url) {
  const browser = await pool.acquire();
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Block resource หนัก (ไม่ block xhr/fetch)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });

    // ตรวจ protection
    const html = await page.content();
    if (/captcha|cloudflare|verify you are human|attention required/i.test(html)) {
      return { success: false, error: 'Blocked by protection' };
    }

    // XPath หาปุ่ม Continue/Free/Access (ครอบคลุม 2025)
    const xp = "//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or " +
               "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'free') or " +
               "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'access') or " +
               "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'get link')] | " +
               "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or " +
               "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'get link')]";

    // คลิกสูงสุด 2 ครั้ง (Linkvertise มัก 1 ขั้น)
    let clicked = 0;
    while (clicked < 2) {
      try {
        await page.waitForXPath(xp, { timeout: 15000 });
        const [btn] = await page.$x(xp);
        if (btn) {
          await btn.click();
          clicked++;
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
            page.waitForTimeout(20000)
          ]);
        }
      } catch (e) {
        break;
      }
    }

    const finalUrl = page.url();
    const content = await page.evaluate(() => document.body.innerText.substring(0, 800)); // ถ้ามี key/paste

    return { success: true, destination: finalUrl, content: content.trim() };

  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    await page.close();
    pool.release(browser);
  }
}

// === Endpoint (เฉพาะ Linkvertise) ===
app.get('/bypass', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.toLowerCase().includes('linkvertise.com')) {
    return res.status(400).json({ error: 'Only Linkvertise links allowed!' });
  }

  const result = await bypassLinkvertise(url);
  res.json(result);
});

app.get('/', (req, res) => {
  res.send('<h1>Linkvertise Bypass API - Dec 2025</h1><p>/bypass?url=https://linkvertise.com/...</p><p>Fast & Reliable • Use responsibly!</p>');
});

app.listen(PORT, () => {
  console.log(`Linkvertise Bypass API running on port ${PORT}`);
});
