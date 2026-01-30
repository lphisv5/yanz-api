const ANDROID_URL = 'https://roblox.en.uptodown.com/android';

async function fetchAndroidVersion() {
  const response = await fetch(ANDROID_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  
  const match = html.match(/<div class="version">([\d]+\.[\d]+\.[\d]+)<\/div>/);
  if (!match) throw new Error('Version not found in HTML');
  
  return match[1];
}

export default async function handler(req, res) {
  try {
    const version = await fetchAndroidVersion();
    
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.json({
      version,
      platform: 'android',
    });
  } catch (error) {
    console.error('Error fetching Android version:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Android version', 
      details: error.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

