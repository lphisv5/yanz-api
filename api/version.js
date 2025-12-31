const ANDROID_URL = 'https://roblox-game.en.aptoide.com/versions';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL);
  if (!response.ok) throw new Error('Failed to fetch Android page');
  const html = await response.text();

  // เจาะจงหาในส่วน Latest Version of Roblox เท่านั้น
  const match = html.match(/Latest Version of Roblox[\s\S]*?([\d]+\.[\d]+\.[\d]+)/i);
  if (match) return match[1];

  // Fallback ถ้าโครงสร้างเปลี่ยน
  const fallback = html.match(/2\.[\d]+\.[\d]+/); // Roblox mobile มักขึ้นต้น 2.
  if (!fallback) throw new Error('Cannot parse Android version');
  return fallback[0];
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
  if (!response.ok) throw new Error('Failed to fetch iOS page');
  const html = await response.text();

  // ดึงจาก mostRecentVersion หรือ Version History
  const match = html.match(/mostRecentVersion[\s\S]*?([\d]+\.[\d]+\.[\d]+)/i) ||
                html.match(/Version History[\s\S]*?([\d]+\.[\d]+\.[\d]+)/i) ||
                html.match(/([\d]+\.[\d]+\.[\d]+)/); // fallback ตัวแรก
  if (!match) throw new Error('Cannot parse iOS version');
  return match[1];
}

export default async function handler(req, res) {
  const platform = (req.query.platform || '').toLowerCase();

  try {
    let version;
    if (platform === 'android') {
      version = await fetchAndroidVersion();
    } else if (platform === 'ios') {
      version = await fetchIosVersion();
    } else {
      return res.status(400).json({ error: 'Invalid platform. Use android or ios' });
    }

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.status(200).json({
      version,
      platform,
      updated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch version', details: error.message });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
