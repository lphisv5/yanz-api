const ANDROID_URL = 'https://apkpure.com/th/roblox-android-2025/com.roblox.client';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  try {
    const response = await fetch(ANDROID_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    });
    
    if (!response.ok) {
      console.error('APKPure response status:', response.status, response.statusText);
      throw new Error(`Failed to fetch APKPure page: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // ตรวจสอบว่าได้ HTML ที่ถูกต้องหรือไม่
    if (!html || html.length < 100) {
      throw new Error('Received empty or invalid HTML from APKPure');
    }

    // วิธีที่ 1: หาจาก class="version one-line" โดยตรง
    let match = html.match(/<span class="version one-line">([\d]+\.[\d]+\.[\d]+)<\/span>/);
    if (match) {
      console.log('Found version from version one-line class:', match[1]);
      return match[1];
    }

    // วิธีที่ 2: Fallback
    match = html.match(/<div class="info-content one-line"[\s\S]*?<span class="version one-line">([\d]+\.[\d]+\.[\d]+)<\/span>/);
    if (match) return match[1];

    // วิธีที่ 3: Fallback
    match = html.match(/<h1>Roblox<\/h1>[\s\S]{0,200}?([\d]+\.[\d]+\.[\d]+)/i);
    if (match) return match[1];

    // วิธีที่ 4: Ultimate fallback
    match = html.match(/(2\.[\d]+\.[\d]+)/);
    if (!match) {
      // บันทึก HTML ส่วนต้นเพื่อ debug
      console.error('HTML sample (first 2000 chars):', html.substring(0, 2000));
      throw new Error('Cannot parse Android version from APKPure');
    }
    
    return match[1];
    
  } catch (error) {
    console.error('Error in fetchAndroidVersion:', error.message);
    throw error;
  }
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    }
  });
  
  if (!response.ok) throw new Error(`Failed to fetch iOS page: ${response.status}`);
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
    console.error('API handler error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch version', 
      details: error.message,
      platform: platform 
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
