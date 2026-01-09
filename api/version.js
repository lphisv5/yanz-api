const ANDROID_URL = 'https://roblox.en.uptodown.com/android';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  
  const match = html.match(/<div class="version">([\d]+\.[\d]+\.[\d]+)<\/div>/);
  if (!match) throw new Error('Version not found in HTML');
  
  return match[1];
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  
  // วิธีที่ 1: หาจาก JSON-LD script (แม่นยำที่สุด)
  const scriptRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      // ตรวจสอบว่าเป็นข้อมูลของแอป Roblox
      if (jsonData && jsonData.name && jsonData.name.toLowerCase().includes('roblox')) {
        if (jsonData.version) {
          const versionMatch = jsonData.version.match(/([\d]+\.[\d]+\.[\d]+)/);
          if (versionMatch) {
            console.log('Found iOS version from JSON-LD:', versionMatch[1]);
            return versionMatch[1];
          }
        }
        if (jsonData.softwareVersion) {
          const versionMatch = jsonData.softwareVersion.match(/([\d]+\.[\d]+\.[\d]+)/);
          if (versionMatch) {
            console.log('Found iOS version from softwareVersion:', versionMatch[1]);
            return versionMatch[1];
          }
        }
      }
    } catch (e) {
      // Continue to next script
    }
  }
  
  // วิธีที่ 2: หาจาก pattern เฉพาะสำหรับ Roblox iOS
  // App Store มักแสดงเวอร์ชันในรูปแบบ: "Version 2.703.1353"
  const versionPattern = /Version[\s\S]{0,300}?(2\.\d{3}\.\d{3,4})/i;
  const versionMatch = html.match(versionPattern);
  if (versionMatch) {
    console.log('Found iOS version from Version text:', versionMatch[1]);
    return versionMatch[1];
  }
  
  // วิธีที่ 3: หาจาก what's new section
  const whatsNewPattern = /"whatsNew"[\s\S]{0,500}?"version"[\s\S]{0,100}?"string"[\s\S]{0,100}?"([\d]+\.[\d]+\.[\d]+)"/i;
  const whatsNewMatch = html.match(whatsNewPattern);
  if (whatsNewMatch) {
    console.log('Found iOS version from whatsNew:', whatsNewMatch[1]);
    return whatsNewMatch[1];
  }
  
  // วิธีที่ 4: หาจาก App Store ใหม่ pattern
  const appStorePattern = /"versionDisplay"[\s\S]{0,100}?"([\d]+\.[\d]+\.[\d]+)"/i;
  const appStoreMatch = html.match(appStorePattern);
  if (appStoreMatch) {
    console.log('Found iOS version from versionDisplay:', appStoreMatch[1]);
    return appStoreMatch[1];
  }
  
  // วิธีที่ 5: Fallback - หา pattern เฉพาะ Roblox 2.xxx.xxx
  const robloxPattern = /(2\.\d{3}\.\d{3,4})/;
  const robloxMatch = html.match(robloxPattern);
  if (robloxMatch) {
    console.log('Found iOS version from Roblox pattern:', robloxMatch[1]);
    return robloxMatch[1];
  }
  
  throw new Error('iOS version not found');
}

export default async function handler(req, res) {
  const platform = (req.query.platform || '').toLowerCase();
  
  if (!['android', 'ios'].includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform. Use android or ios' });
  }

  try {
    const version = platform === 'android' 
      ? await fetchAndroidVersion() 
      : await fetchIosVersion();
    
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.json({
      version,
      platform,
      updated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching version:', error);
    res.status(500).json({ 
      error: 'Failed to fetch version', 
      details: error.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
