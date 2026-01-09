const ANDROID_URL = 'https://play.google.com/store/apps/details?id=com.roblox.client';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'th-TH,th;q=0.9'
    }
  });
  
  if (!response.ok) throw new Error('Failed to fetch Google Play page');
  const html = await response.text();

  // วิธีที่ 1: หาเวอร์ชันล่าสุดจากส่วนอุปกรณ์ (2.703.1353)
  // Pattern สำหรับส่วน "ความเข้ากันได้กับอุปกรณ์ที่คุณใช้อยู่"
  const deviceSectionMatch = html.match(/ความเข้ากันได้กับอุปกรณ์ที่คุณใช้อยู่[\s\S]*?(<div class="G1zzid">[\s\S]*?)<div class="SerYrb">/i);
  
  if (deviceSectionMatch) {
    const deviceHtml = deviceSectionMatch[1];
    
    // หาเวอร์ชันทั้งหมดในส่วนนี้
    const versionMatches = deviceHtml.matchAll(/<div class="reAt0">([\d]+\.[\d]+\.[\d]+)<\/div>/g);
    const versions = Array.from(versionMatches).map(match => match[1]);
    
    if (versions.length > 0) {
      // คืนค่าเวอร์ชันแรกที่เจอ (มักจะเป็นล่าสุด)
      console.log('Found device versions:', versions);
      return versions[0]; // ควรจะเป็น 2.703.1353
    }
  }

  // วิธีที่ 2: หาจาก pattern ที่เจาะจงมากขึ้นสำหรับส่วนอุปกรณ์
  const specificDevicePattern = /Vivo V2342[\s\S]*?<div class="reAt0">([\d]+\.[\d]+\.[\d]+)<\/div>/i;
  const specificMatch = html.match(specificDevicePattern);
  if (specificMatch) {
    console.log('Found specific device version:', specificMatch[1]);
    return specificMatch[1];
  }

  // วิธีที่ 3: หาจากเวอร์ชันทั่วไปถ้าไม่เจอส่วนอุปกรณ์
  const generalPattern = /<div class="q078ud">เวอร์ชัน<\/div>[\s\S]{0,100}?<div class="reAt0">([\d]+\.[\d]+\.[\d]+)<\/div>/i;
  const generalMatch = html.match(generalPattern);
  if (generalMatch) {
    console.log('Found general version:', generalMatch[1]);
    return generalMatch[1];
  }

  // วิธีที่ 4: Fallback แบบง่าย
  const fallbackMatch = html.match(/(2\.\d{3}\.\d{3,4})/);
  if (fallbackMatch) {
    console.log('Fallback version:', fallbackMatch[1]);
    return fallbackMatch[1];
  }

  throw new Error('Cannot parse Android version from Google Play');
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
  if (!response.ok) throw new Error('Failed to fetch iOS page');
  const html = await response.text();

  // หาจาก script JSON-LD
  const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/i);
  if (scriptMatch) {
    try {
      const jsonData = JSON.parse(scriptMatch[1]);
      if (jsonData.version) {
        const versionMatch = jsonData.version.match(/([\d]+\.[\d]+\.[\d]+)/);
        if (versionMatch) return versionMatch[1];
      }
    } catch (e) {}
  }

  // Fallback
  const match = html.match(/Version[\s\S]{0,200}?([\d]+\.[\d]+\.[\d]+)/i) || 
                html.match(/(2\.[\d]+\.[\d]+)/);
  if (match) return match[1];
  
  throw new Error('Cannot parse iOS version');
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
