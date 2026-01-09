const ANDROID_URL = 'https://apkpure.com/th/roblox-android-2025/com.roblox.client';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL);
  if (!response.ok) throw new Error('Failed to fetch Android page');
  const html = await response.text();

  // วิธีที่ 1: หาจาก class="version one-line" โดยตรง
  let match = html.match(/<span class="version one-line">([\d]+\.[\d]+\.[\d]+)<\/span>/i);
  if (match) return match[1];

  // วิธีที่ 2: Fallback - หา pattern ที่มี class version
  match = html.match(/class="[^"]*version[^"]*"[\s\S]{0,100}?>([\d]+\.[\d]+\.[\d]+)</i);
  if (match) return match[1];

  // วิธีที่ 3: Fallback - หา pattern ทั่วไป
  match = html.match(/(2\.[\d]+\.[\d]+)/);
  if (!match) throw new Error('Cannot parse Android version');
  return match[1];
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
  if (!response.ok) throw new Error('Failed to fetch iOS page');
  const html = await response.text();

  // เจาะจง mostRecentVersion หรือ Version History
  let match = html.match(/mostRecentVersion[\s\S]{0,500}?([\d]+\.[\d]+\.[\d]+)/i);
  if (match) return match[1];

  // Fallback: Version ตามด้วยตัวเลข
  match = html.match(/Version[\s\S]{0,200}?(2\.[\d]+\.[\d]+)/i);
  if (match) return match[1];

  // Ultimate fallback: ตัวแรกที่ขึ้นต้น 2.
  match = html.match(/(2\.[\d]+\.[\d]+)/);
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
