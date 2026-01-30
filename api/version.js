const ANDROID_URL = 'https://roblox.en.uptodown.com/android';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';
const WINDOWS_VERSION_URL = 'https://setup.rbxcdn.com/version';
const DEPLOY_HISTORY_URL = 'https://setup.rbxcdn.com/DeployHistory.txt';

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
  
  const scriptRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
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
    }
  }
  
  const versionPattern = /Version[\s\S]{0,300}?(2\.\d{3}\.\d{3,4})/i;
  const versionMatch = html.match(versionPattern);
  if (versionMatch) {
    console.log('Found iOS version from Version text:', versionMatch[1]);
    return versionMatch[1];
  }
  
  const whatsNewPattern = /"whatsNew"[\s\S]{0,500}?"version"[\s\S]{0,100}?"string"[\s\S]{0,100}?"([\d]+\.[\d]+\.[\d]+)"/i;
  const whatsNewMatch = html.match(whatsNewPattern);
  if (whatsNewMatch) {
    console.log('Found iOS version from whatsNew:', whatsNewMatch[1]);
    return whatsNewMatch[1];
  }
  
  const appStorePattern = /"versionDisplay"[\s\S]{0,100}?"([\d]+\.[\d]+\.[\d]+)"/i;
  const appStoreMatch = html.match(appStorePattern);
  if (appStoreMatch) {
    console.log('Found iOS version from versionDisplay:', appStoreMatch[1]);
    return appStoreMatch[1];
  }
  
  const robloxPattern = /(2\.\d{3}\.\d{3,4})/;
  const robloxMatch = html.match(robloxPattern);
  if (robloxMatch) {
    console.log('Found iOS version from Roblox pattern:', robloxMatch[1]);
    return robloxMatch[1];
  }
  
  throw new Error('iOS version not found');
}

async function fetchWindowsVersion() {
  const response = await fetch(WINDOWS_VERSION_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const versionText = await response.text();
  
  // Remove any whitespace and validate format
  const version = versionText.trim();
  if (!version.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    throw new Error('Invalid version format');
  }
  
  return version;
}

async function fetchClientVersionUpload() {
  try {
    const response = await fetch(DEPLOY_HISTORY_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    
    // Get the first line which contains the latest version
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const latestLine = lines[0].trim();
      // Format: "New 0.xxx.x.xxxxxxx at 2024... Done version-xxxxx"
      const versionMatch = latestLine.match(/version-([a-f0-9]+)/);
      if (versionMatch) {
        return `version-${versionMatch[1]}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching clientVersionUpload:', error);
    return null;
  }
}

export default async function handler(req, res) {
  const platform = (req.query.platform || '').toLowerCase();
  
  if (!['android', 'ios', 'windows'].includes(platform)) {
    return res.status(400).json({ 
      error: 'Invalid platform. Use android, ios, or windows' 
    });
  }

  try {
    let version;
    let additionalData = {};
    
    if (platform === 'android') {
      version = await fetchAndroidVersion();
    } else if (platform === 'ios') {
      version = await fetchIosVersion();
    } else if (platform === 'windows') {
      version = await fetchWindowsVersion();
      const clientVersionUpload = await fetchClientVersionUpload();
      if (clientVersionUpload) {
        additionalData.clientVersionUpload = clientVersionUpload;
      }
    }
    
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.json({
      version,
      platform,
      ...additionalData
    });
  } catch (error) {
    console.error(`Error fetching ${platform} version:`, error);
    res.status(500).json({ 
      error: `Failed to fetch ${platform} version`, 
      details: error.message 
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
