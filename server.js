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

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { error: 'Too many requests, wait bro.' }
});
app.use(limiter);

// Browser Pool (max 2 สำหรับ Termux)
const browserFactory = {
  create: async () => {
    return await puppeteer.launch({
      headless: 'new',
      executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
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

const pool = createPool(browserFactory, { max: 2, min: 1, idleTimeoutMillis: 300000 });

// === Bypass Loot FAST (10-15 วินาที) ===
async function bypassLootFast(url) {
  const browser = await pool.acquire();
  const context = await browser.createIncognitoBrowserContext();
  const page = await context.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36');

    // Block เฉพาะหนัก (ไม่ block xhr/fetch → WebSocket/redirect เวิร์ค)
    await page.setRequestInterception(true);
    page.on('request', r => {
      if (['image', 'media', 'font', 'stylesheet'].includes(r.resourceType())) {
        r.abort();
      } else {
        r.continue();
      }
    });

    // โหลดไว
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });

    // ตรวจ protection
    const html = await page.content();
    if (/captcha|cloudflare|verify you are human|attention required/i.test(html)) {
      return { success: false, error: 'Blocked by protection (CAPTCHA/Cloudflare)' };
    }

    // XPath หาปุ่ม Continue / Next / Get Link / Proceed (ครอบคลุม Loot 2025)
    const xp = 
      "//a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'next') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'proceed') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'get link') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'unlock')] | " +
      "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'next') or " +
      "contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'proceed')]";

    // รอ + คลิกปุ่มสูงสุด 2 ครั้ง (Loot มัก 1-2 ขั้น)
    let clicked = 0;
    while (clicked < 2) {
      try {
        await page.waitForXPath(xp, { timeout: 15000 });
        const [btn] = await page.$x(xp);
        if (btn) {
          await btn.click();
          clicked++;
          // รอ redirect สั้น
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
            page.waitForTimeout(20000)
          ]);
        } else {
          break;
        }
      } catch (e) {
        break; // ไม่มีปุ่มแล้ว
      }
    }

    // ถ้ามี WebSocket redirect (Loot บางเวอร์ชันใช้) – ดึงจาก console หรือ network
    const finalUrl = page.url();

    // ถ้าเป็น key system ดึง content/key
    const content = await page.evaluate(() => document.body.innerText.substring(0, 800));

    return { success: true, destination: finalUrl, content: content };

  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    await context.close();
    pool.release(browser);
  }
}

// === Endpoint (Loot เท่านั้น) ===
app.get('/bypass', async (req, res) => {
  const { url } = req.query;

  const lower = url ? url.toLowerCase() : '';
  if (!url || !(lower.includes('loot-link') || lower.includes('lootlinks') || lower.includes('lootdest') || lower.includes('lootlabs') || lower.includes('links-loot'))) {
    return res.status(400).json({ error: 'Send only Lootlabs / Loot-Link / Loot-Dest links!' });
  }

  console.log(`Bypassing Loot fast: ${url}`);
  const result = await bypassLootFast(url);
  res.json(result);
});

app.get('/', (req, res) => {
  res.send(`
    <h2>Lootlabs Bypass API - Fast Mode (10-15s on Termux)</h2>
    <p>Usage: /bypass?url=https://loot-link.com/... or lootdest.org etc.</p>
    <p>Only Lootlabs family supported • Super fast • Minimal clicks</p>
    <p>Dec 2025 - Termux optimized</p>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Loot Fast Bypass API running on http://127.0.0.1:${PORT}`);
});
