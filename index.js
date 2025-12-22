const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());

// หลวมสุดสำหรับฟรี public (หรือปรับ max สูง ๆ)
app.set('trust proxy', 1); // แก้ error Render

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // 100 ครั้ง/นาที = แทบไม่จำกัดสำหรับคนปกติ
  message: { error: 'Slow down a bit!' }
});
app.use(limiter);

// === Bypass Linkvertise Direct API (3-8 วินาที) ===
async function bypassLinkvertiseDirect(url) {
  try {
    // Parse path จาก linkvertise.com/ID/name หรือ ?o=sharing
    const parsedUrl = new URL(url);
    let path = parsedUrl.pathname; // เช่น /12345/name

    // GET static เพื่อดึง link_id
    const staticRes = await axios.get(`https://publisher.linkvertise.com/api/v1/redirect/link/static${path}`);
    const linkId = staticRes.data.data.link.id;

    if (!linkId) throw new Error('Invalid link or blocked');

    // สร้าง payload serial (hack level - fixed random จากตัวอย่างเก่า+ใหม่)
    const payload = {
      timestamp: Date.now(),
      random: "6548307", // ค่าคงที่ที่เวิร์ค 2025
      link_id: linkId
    };
    const serial = Buffer.from(JSON.stringify(payload)).toString('base64');

    // GET target ด้วย serial
    const targetRes = await axios.get(`https://publisher.linkvertise.com/api/v1/redirect/link\( {path}/target?serial= \){serial}`);

    const destination = targetRes.data.data.target || targetRes.data.destination;

    if (!destination) throw new Error('Bypass failed - link protected or changed');

    return { success: true, destination };

  } catch (error) {
    return { success: false, error: error.message || 'Bypass failed' };
  }
}

// === Endpoint ===
app.get('/bypass', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.toLowerCase().includes('linkvertise.com')) {
    return res.status(400).json({ error: 'Only Linkvertise links!' });
  }

  const result = await bypassLinkvertiseDirect(url);
  res.json(result);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Linkvertise Bypass API - HACK MODE 2025</h1>
    <p>/bypass?url=https://linkvertise.com/...</p>
    <p>Direct API Bypass • 3-8 seconds • No browser • Public Free</p>
    <p>Limit: 100/min (practically unlimited)</p>
  `);
});

app.listen(PORT, () => {
  console.log(`Hack Bypass API running on port ${PORT}`);
});
