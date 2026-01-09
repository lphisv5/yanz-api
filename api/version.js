const ANDROID_URL = 'https://roblox.en.uptodown.com/android';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';

async function fetchAndroidVersion() {
  try {
    const response = await fetch(ANDROID_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Uptodown page: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    let match = html.match(/<div class="version">([\d]+\.[\d]+\.[\d]+)<\/div>/);
    if (match) {
      console.log('Found version from Uptodown:', match[1]);
      return match[1];
    }

    match = html.match(/<div class="info"[\s\S]*?<div class="version">([\d]+\.[\d]+\.[\d]+)<\/div>/);
    if (match) return match[1];

    match = html.match(/detail-app-name[\s\S]{0,200}?<div class="version">([\d]+\.[\d]+\.[\d]+)<\/div>/);
    if (match) return match[1];

    match = html.match(/(2\.\d{3}\.\d{3,4})/);
    if (!match) throw new Error('Cannot parse version from Uptodown');
    
    return match[1];
    
  } catch (error) {
    console.error('Uptodown fetch error:', error.message);
    throw error;
  }
}

async function fetchIosVersion() {
  try {
    const response = await fetch(IOS_URL);
    if (!response.ok) throw new Error(`Failed to fetch iOS page: ${response.status}`);
    const html = await response.text();

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

    let match = html.match(/Version[\s\S]{0,200}?([\d]+\.[\d]+\.[\d]+)/i);
    if (match) {
      console.log('iOS version from Version text:', match[1]);
      return match[1];
    }

    match = html.match(/(2\.[\d]+\.[\d]+)/);
    if (!match) throw new Error('Cannot parse iOS version');
    
    console.log('iOS fallback version:', match[1]);
    return match[1];
    
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
      updated: new Date().toISOString(),
      source: platform === 'android' ? 'Uptodown' : 'App Store'
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
