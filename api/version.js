const ANDROID_URL = 'https://roblox-game.en.aptoide.com/versions';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL);
  if (!response.ok) throw new Error('Failed to fetch Android page');
  const html = await response.text();

  // Regex หาเวอร์ชันใน Latest Version (เจาะจง pattern ที่มีตัวเลข . )
  const match = html.match(/Latest Version of Roblox[^>]*>\s*<[^>]*>\s*([\d\.]+)/i);
  if (match) return match[1];

  // Fallback regex กว้างกว่า
  const fallback = html.match(/([\d]+\.[\d]+\.[\d]+)/);
  if (!fallback) throw new Error('Cannot parse Android version');
  return fallback[1];
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
  if (!response.ok) throw new Error('Failed to fetch iOS page');
  const html = await response.text();

  // Regex หาใน mostRecentVersion หรือ Version History
  const match = html.match(/mostRecentVersion[^>]*>\s*<[^>]*>\s*([\d\.]+)/i) ||
                html.match(/Version\s*([\d\.]+)/i);
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
    console.error('Fetch error:', error); // log เพื่อดูใน Vercel
    res.status(500).json({ error: 'Failed to fetch version', details: error.message });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
