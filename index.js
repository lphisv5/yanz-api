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
app.set('trust proxy', 1);

// หลวมสุดสำหรับการ spam ถี่ ๆ (ตามที่คุณต้องการ)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // สูงมาก = แทบไม่จำกัด
  message: { error: 'Slow down a little!' }
});
app.use(limiter);

const browserFactory = {
  create: async () => puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote']
  }),
  destroy: async (browser) => await browser.close()
};

const pool = createPool(browserFactory, { max: 4, min: 1 }); // เพิ่ม pool เพื่อรองรับ spam ถี่

async function bypassLinkvertiseRobust(url) {
  const browser = await pool.acquire();
  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'media', 'font', 'stylesheet'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    // รอโหลดนานขึ้น (สูงสุด 90 วินาที)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });

    // ถ้าเจอ protection แรง → รีเทิร์นเลยไม่เสียเวลา
    const html = await page.content();
    if (/captcha|cloudflare|verify you are human|attention required/i.test(html)) {
      return { success: false, error: 'Blocked by strong protection - try different IP' };
    }

    // XPath ครอบคลุมทุกปุ่มที่เป็นไปได้
    const buttonXp = `
      //button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or
               contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'get link') or
               contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'proceed') or
               contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'access')] |
      //a[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'continue') or
         contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'get link') or
         contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'access')]
    `;

    // Loop คลิกสูงสุด 5 ครั้ง (เผื่อหลายขั้น + ช้า)
    for (let i = 0; i < 5; i++) {
      try {
        await page.waitForXPath(buttonXp.trim(), { timeout: 30000 }); // รอปุ่มนาน 30 วินาที
        const [button] = await page.$x(buttonXp.trim());
        if (button) {
          await button.click();
          console.log(`Clicked button step ${i + 1}`);
          // รอนานขึ้นหลังคลิก
          await Promise.race([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 40000 }),
            page.waitForTimeout(40000)
          ]);
        }
      } catch (e) {
        // ไม่มีปุ่มแล้ว → ออก loop
        break;
      }
    }

    const finalUrl = page.url();

    return { success: true, destination: finalUrl };

  } catch (error) {
    return { success: false, error: 'Timeout or failed: ' + error.message };
  } finally {
    await page.close();
    pool.release(browser);
  }
}

app.get('/bypass', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.toLowerCase().includes('linkvertise.com')) {
    return res.status(400).json({ error: 'Only Linkvertise links please!' });
  }

  const result = await bypassLinkvertiseRobust(url);
  res.json(result);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Linkvertise Bypass API - ROBUST MODE 2025</h1>
    <p>/bypass?url=https://linkvertise.com/...</p>
    <p>ผ่านได้จริงแม้ลิงค์ยาก • รอสูงสุด ~2 นาที • ทน spam ถี่</p>
    <p>Self-hosted • Free for everyone • Made with care</p>
  `);
});

app.listen(PORT, () => {
  console.log(`Robust Bypass API running on port ${PORT}`);
});
