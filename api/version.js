const ANDROID_URL = 'https://www.apkmirror.com/apk/roblox-corporation/roblox/';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  try {
    // ใช้ APKMirror แทน (มักอนุญาตให้ดึงข้อมูลได้)
    const response = await fetch(ANDROID_URL);
    if (!response.ok) throw new Error(`Failed to fetch APKMirror page: ${response.status}`);
    
    const html = await response.text();
    
    // ลองหาเวอร์ชันในหลายรูปแบบ
    const patterns = [
      /<span class="infoSlide-value">([\d]+\.[\d]+\.[\d]+)<\/span>/,
      /<p class="infoSlide-value">([\d]+\.[\d]+\.[\d]+)<\/p>/,
      /Latest Version:[\s\S]*?([\d]+\.[\d]+\.[\d]+)/i,
      /<h2 class="latestApk__title">[\s\S]*?([\d]+\.[\d]+\.[\d]+)[\s\S]*?<\/h2>/,
      /(2\.\d{3}\.\d{3,4})/  // Pattern เฉพาะ Roblox
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        console.log('Found version with pattern:', match[1]);
        return match[1];
      }
    }

    throw new Error('Cannot parse version from APKMirror');
    
  } catch (error) {
    console.error('APKMirror fetch error:', error);
    // Fallback ไปหาแหล่งข้อมูลอื่น
    return await fetchAndroidVersionFallback();
  }
}

async function fetchAndroidVersionFallback() {
  // ทางเลือกเสริม: ใช้ uptodown
  const fallbackUrl = 'https://roblox.en.uptodown.com/android';
  try {
    const response = await fetch(fallbackUrl);
    if (!response.ok) throw new Error('Failed to fetch fallback');
    
    const html = await response.text();
    const match = html.match(/version__number">([\d]+\.[\d]+\.[\d]+)</i) ||
                  html.match(/<dt>Version<\/dt>[\s\S]*?<dd>([\d]+\.[\d]+\.[\d]+)<\/dd>/i);
    
    if (match) return match[1];
  } catch (e) {
    console.error('Fallback also failed:', e.message);
  }
  
  throw new Error('All Android version sources failed');
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
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
  const match = html.match(/Version[\s\S]{0,200}?([\d]+\.[\d]+\.[\d]+)/i);
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
