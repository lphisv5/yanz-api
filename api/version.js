import { parse } from 'node-html-parser';

const ANDROID_URL = 'https://roblox-game.en.aptoide.com/versions';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL);
  if (!response.ok) throw new Error('Failed to fetch Android page');
  const html = await response.text();
  const root = parse(html);

  // ดึงจาก Latest Version item แรก
  const versionText = root.querySelector('div.versions__VersionsItemContainer-sc-1ldjlrq-7')?.innerText || '';
  const match = versionText.match(/(\d+\.\d+\.\d+)/);
  if (!match) throw new Error('Cannot parse Android version');
  return match[1];
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
  if (!response.ok) throw new Error('Failed to fetch iOS page');
  const html = await response.text();
  const root = parse(html);

  // ดึงจาก h4 ใน mostRecentVersion
  const version = root.querySelector('section#mostRecentVersion h4')?.innerText.trim();
  if (!version || !/^\d+\.\d+/.test(version)) throw new Error('Cannot parse iOS version');
  return version;
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
    console.error(error); // สำคัญ: log error เพื่อ debug บน Vercel
    res.status(500).json({ error: 'Failed to fetch version', details: error.message });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
