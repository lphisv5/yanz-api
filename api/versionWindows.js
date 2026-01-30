const WINDOWS_URL = 'https://www.microsoft.com/store/productId/9NBLGGGZM6WM';

async function fetchWindowsVersion() {
  const response = await fetch(WINDOWS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const html = await response.text();
  
  // Try to find version in JSON-LD structured data
  const scriptRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      if (jsonData && jsonData['@type'] === 'SoftwareApplication') {
        if (jsonData.softwareVersion) {
          const versionMatch = jsonData.softwareVersion.match(/([\d]+\.[\d]+\.[\d]+\.[\d]+)/);
          if (versionMatch) {
            console.log('Found Windows version from JSON-LD softwareVersion:', versionMatch[1]);
            return versionMatch[1];
          }
        }
      }
    } catch (e) {
      // Silent catch for parsing errors
    }
  }
  
  // Try to find version in meta tags
  const metaVersionPattern = /<meta[^>]*property="og:version"[^>]*content="([^"]*)"[^>]*>/i;
  const metaMatch = html.match(metaVersionPattern);
  if (metaMatch) {
    const versionMatch = metaMatch[1].match(/([\d]+\.[\d]+\.[\d]+\.[\d]+)/);
    if (versionMatch) {
      console.log('Found Windows version from meta tag:', versionMatch[1]);
      return versionMatch[1];
    }
  }
  
  // Try to find version in the page content
  const versionPattern = /Version[\s\S]{0,300}?([\d]+\.[\d]+\.[\d]+\.[\d]+)/i;
  const versionMatch = html.match(versionPattern);
  if (versionMatch) {
    console.log('Found Windows version from Version text:', versionMatch[1]);
    return versionMatch[1];
  }
  
  // Look for any 4-part version number pattern (x.x.x.x)
  const genericVersionPattern = /([\d]+\.[\d]+\.[\d]+\.[\d]+)/;
  const genericMatch = html.match(genericVersionPattern);
  if (genericMatch) {
    console.log('Found Windows version from generic pattern:', genericMatch[1]);
    return genericMatch[1];
  }
  
  throw new Error('Windows version not found');
}

export default async function handler(req, res) {
  try {
    const version = await fetchWindowsVersion();
    
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.json({
      version,
      platform: 'windows',
    });
  } catch (error) {
    console.error('Error fetching Windows version:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Windows version', 
      details: error.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

