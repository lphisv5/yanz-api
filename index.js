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
app.use(express.json());

// Rate limit เข้ม (ป้องกัน abuse)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 requests/IP/นาที
  message: { error: 'Too many requests. Chill for a minute.' }
});
app.use(limiter);

// === Browser Pool (สำคัญมากสำหรับ Render) ===
const browserFactory = {
  create: async () => {
    return await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-extensions',
        '--disable-background-networking'
        // ไม่ใช้ --single-process บน Render → เสถียรกว่า
      ]
    });
  },
  destroy: async (browser) => await browser.close()
};

const pool = createPool(browserFactory, {
  max: 3, // Render 512MB-1GB RAM ไหว 3 ตัว
  min: 1,
  idleTimeoutMillis: 300000 // ปิดถ้า idle 5 นาที
});

// === Bypass Loot FAST (Production Optimized) ===
async function bypassLootFast(url) {
  const browser = await pool.acquire();
  const page = await browser.newPage(); // ไม่ใช้ incognito → ไม่ error + เร็วกว่า

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // เปิด JS + Cache → เร็วขึ้น
    await page.setJavaScriptEnabled(true);
    await page.setCacheEnabled(true);

    // Block เฉพาะหนักจริง ๆ
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // ตรวจ protection
    const html = await page.content();
    if (/captcha|cloudflare|verify you are human|attention required/i.test(html)) {
      return { success: false, error: 'Blocked by CAPTCHA/Cloudflare' };
    }

    const xp = 
      "//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'next') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'proceed') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'get link') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'unlock')] | " +
      "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'next') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'proceed')]";

    let clicked = 0;
    while (clicked < 3) { // สูงสุด 3 คลิก
      try {
        await page.waitForXPath(xp, { timeout: 18000 });
        const [btn] = await page.$x(xp);
        if (btn) {
          await btn.click();
          clicked++;
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }),
            page.waitForTimeout(25000)
          ]);
        } else {
          break;
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

// === Endpoint ===
app.get('/bypass', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  const lower = url.toLowerCase();
  if (!(lower.includes('loot-link') || lower.includes('lootlinks') || lower.includes('lootdest') || lower.includes('lootlabs'))) {
    return res.status(400).json({ error: 'Lootlabs links only!' });
  }

  console.log(`Bypassing: ${url}`);
  const result = await bypassLootFast(url);
  res.json(result);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Lootlabs Bypass API - Render Ready (Dec 2025)</h1>
    <p>/bypass?url=https://loot-link.com/...</p>
    <p>Fast • Stable • Production Optimized</p>
    <p>Use responsibly!</p>
  `);
});

app.listen(PORT, () => {
  console.log(`Loot Bypass API running on port ${PORT}`);
});
