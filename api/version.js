const ANDROID_URL = 'https://roblox.en.uptodown.com/android';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  try {
    const response = await fetch(ANDROID_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Android page: ${response.status}`);
    }
    
    const html = await response.text();
    
    // หาเวอร์ชันจาก class="version"
    const match = html.match(/<div class="version">([\d]+\.[\d]+\.[\d]+)<\/div>/);
    if (match) {
      return match[1];
    }

    // Fallback pattern
    const fallbackMatch = html.match(/(2\.\d{3}\.\d{3,4})/);
    if (!fallbackMatch) throw new Error('Cannot parse Android version');
    
    return fallbackMatch[1];
    
  } catch (error) {
    console.error('Android fetch error:', error.message);
    throw error;
  }
}

async function fetchIosVersion() {
  try {
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
    
    // Ultimate fallback
    const fallbackMatch = html.match(/(2\.[\d]+\.[\d]+)/);
    if (!fallbackMatch) throw new Error('Cannot parse iOS version');
    
    return fallbackMatch[1];
    
  } catch (error) {
    console.error('iOS fetch error:', error.message);
    throw error;
  }
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
      details: error.message
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
