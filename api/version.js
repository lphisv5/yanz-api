import { load } from 'cheerio';

const ANDROID_URL = 'https://roblox-game.en.aptoide.com/versions';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL);
  if (!response.ok) throw new Error('Failed to fetch Android page');
  const html = await response.text();
  const $ = load(html);

  // ดึงเวอร์ชันจาก item แรก (index="0") ใน Latest Version
  const version = $('div.versions__VersionsItemContainer-sc-1ldjlrq-7')
    .first()  // หรือ eq(0)
    .find('span:contains(".")')
    .first()
    .text()
    .trim()
    .match(/[\d\.]+/)?.[0];

  if (!version) throw new Error('Cannot parse Android version');
  return version;
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
  if (!response.ok) throw new Error('Failed to fetch iOS page');
  const html = await response.text();
  const $ = load(html);

  // ดึงจาก section mostRecentVersion → h4 แรก
  const version = $('section#mostRecentVersion h4.svelte-13339ih')
    .first()
    .text()
    .trim();

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

    // Cache 5-10 นาที เพื่อไม่โหลดเว็บบ่อยเกิน
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');

    res.status(200).json({
      version,
      platform,
      updated: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch version', details: error.message });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
