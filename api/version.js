const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.roblox.client';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL);
  if (!response.ok) throw new Error('Failed to fetch Google Play page');
  const html = await response.text();

  // วิธีที่ 1: หาจากข้อมูลเวอร์ชันล่าสุดสำหรับอุปกรณ์ปัจจุบัน (2.703.1353)
  // ข้อมูลนี้อยู่ในส่วน "Vivo V2342" หรืออุปกรณ์อื่นๆ
  let match = html.match(/<div class="v0MAtc">[^<]+<\/div>[\s\S]*?<div class="q078ud">เวอร์ชัน<\/div>[\s\S]*?<div class="reAt0">([\d]+\.[\d]+\.[\d]+)<\/div>/i);
  if (match) {
    console.log('Found device-specific version:', match[1]);
    return match[1]; // คืนค่า 2.703.1353
  }

  // วิธีที่ 2: หาจากเวอร์ชันทั่วไป (2.702.632)
  match = html.match(/<div class="q078ud">เวอร์ชัน<\/div>[\s\S]*?<div class="reAt0">([\d]+\.[\d]+\.[\d]+)<\/div>/i);
  if (match) {
    console.log('Found general version:', match[1]);
    return match[1]; // คืนค่า 2.702.632
  }

  // วิธีที่ 3: หาจาก pattern เฉพาะสำหรับเวอร์ชัน Roblox
  match = html.match(/2\.\d{3}\.\d{3,4}/);
  if (match) {
    console.log('Found Roblox pattern version:', match[0]);
    return match[0];
  }

  // วิธีที่ 4: Fallback ทั่วไป
  match = html.match(/(2\.[\d]+\.[\d]+)/);
  if (!match) throw new Error('Cannot parse Android version from Google Play');
  return match[1];
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
  if (!response.ok) throw new Error('Failed to fetch iOS page');
  const html = await response.text();

  // วิธีที่ 1: หาจาก script JSON-LD ใน App Store
  const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/i);
  if (scriptMatch) {
    try {
      const jsonData = JSON.parse(scriptMatch[1]);
      if (jsonData.version) {
        const versionMatch = jsonData.version.match(/([\d]+\.[\d]+\.[\d]+)/);
        if (versionMatch) return versionMatch[1];
      }
      if (jsonData.softwareVersion) {
        const versionMatch = jsonData.softwareVersion.match(/([\d]+\.[\d]+\.[\d]+)/);
        if (versionMatch) return versionMatch[1];
      }
    } catch (e) {
      // Ignore JSON parse error
    }
  }

  // วิธีที่ 2: หาจาก what's new section
  let match = html.match(/Version[\s\S]{0,200}?([\d]+\.[\d]+\.[\d]+)/i);
  if (match) return match[1];

  // วิธีที่ 3: Fallback
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
