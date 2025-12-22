const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());

// Rate limit เข้มขึ้นนิด (เช่น 5 requests/IP/นาที เพราะ Puppeteer กิน resource)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many requests, please wait a minute.' }
});
app.use(limiter);

async function bypassWithPuppeteer(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    let steps = 0;
    while (steps < 15) {
      await page.waitForTimeout(10000 + Math.random() * 5000);

      const button = await page.$('button:has-text("Continue"), a:has-text("Continue"), button[class*="continue"], a[class*="proceed"], div[role="button"]:has-text("Get Link"), button:has-text("Proceed")');

      if (button) {
        await Promise.all([
          button.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
        ]);
        steps++;
      } else {
        break;
      }
    }

    const finalUrl = page.url();
    const content = await page.evaluate(() => document.body.innerText.substring(0, 500));

    return { success: true, destination: finalUrl, content: content.trim() };

  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

// Endpoint แบบ GET
app.get('/bypass', async (req, res) => {
  const { url } = req.query; // ดึงจาก ?url=

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter. Usage: /bypass?url=https://your-link.com' });
  }

  if (!url.includes('linkvertise.com') && !url.includes('auth.platorelay.com') && !url.includes('gateway.platoboost.com')) {
    return res.status(400).json({ error: 'Unsupported URL. Currently supports Linkvertise & Platorelay/Platoboost only.' });
  }

  console.log(`Bypassing: ${url}`); // log เพื่อ debug

  const result = await bypassWithPuppeteer(url);
  res.json(result);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Free Bypass API (Self-hosted - No External API)</h1>
    <p>Usage: <code>https://your-domain.com/bypass?url=https://linkvertise.com/...</code></p>
    <p>Supports: Linkvertise, Platorelay/Platoboost key systems</p>
    <p><strong>Warning:</strong> Use at your own risk! Bypassing may violate TOS.</p>
  `);
});

app.listen(PORT, () => {
  console.log(`Bypass API (GET) running on port ${PORT}`);
});
