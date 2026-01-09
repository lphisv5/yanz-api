const ANDROID_URL = 'https://apkpure.com/th/roblox-android-2025/com.roblox.client';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL);
  if (!response.ok) throw new Error('Failed to fetch APKPure page');
  const html = await response.text();

  // วิธีที่ 1: หาจาก class="version one-line" โดยตรง (วิธีที่แม่นยำที่สุด)
  let match = html.match(/<span class="version one-line">([\d]+\.[\d]+\.[\d]+)<\/span>/);
  if (match) {
    console.log('Found version from version one-line class:', match[1]);
    return match[1]; // ควรจะได้ 2.703.1353
  }

  // วิธีที่ 2: Fallback - หาจาก pattern version ใน info-content
  match = html.match(/<div class="info-content one-line"[\s\S]*?<span class="version one-line">([\d]+\.[\d]+\.[\d]+)<\/span>/);
  if (match) {
    console.log('Found version from info-content:', match[1]);
    return match[1];
  }

  // วิธีที่ 3: Fallback - หาจาก h1 Roblox แล้วตามด้วยเวอร์ชัน
  match = html.match(/<h1>Roblox<\/h1>[\s\S]{0,200}?([\d]+\.[\d]+\.[\d]+)/i);
  if (match) {
    console.log('Found version near h1 Roblox:', match[1]);
    return match[1];
  }

  // วิธีที่ 4: Ultimate fallback
  match = html.match(/(2\.[\d]+\.[\d]+)/);
  if (!match) throw new Error('Cannot parse Android version from APKPure');
  
  console.log('Fallback version:', match[1]);
  return match[1];
}

async function fetchIosVersion() {
  const response = await fetch(IOS_URL);
  if (!response.ok) throw new Error('Failed to fetch iOS page');
  const html = await response.text();

  // วิธีที่ 1: หาจาก script JSON-LD
  const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/i);
  if (scriptMatch) {
    try {
      const jsonData = JSON.parse(scriptMatch[1]);
      if (jsonData.version) {
        const versionMatch = jsonData.version.match(/([\d]+\.[\d]+\.[\d]+)/);
        if (versionMatch) {
          console.log('iOS version from JSON-LD:', versionMatch[1]);
          return versionMatch[1];
        }
      }
    } catch (e) {
      console.log('JSON parse error:', e.message);
    }
  }

  // วิธีที่ 2: หาจาก what's new section
  let match = html.match(/Version[\s\S]{0,200}?([\d]+\.[\d]+\.[\d]+)/i);
  if (match) {
    console.log('iOS version from Version text:', match[1]);
    return match[1];
  }

  // วิธีที่ 3: Fallback
  match = html.match(/(2\.[\d]+\.[\d]+)/);
  if (!match) throw new Error('Cannot parse iOS version');
  
  console.log('iOS fallback version:', match[1]);
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
