const ANDROID_URL = 'https://roblox.en.uptodown.com/android';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';
const WINDOWS_API_URL = 'https://clientsettings.roblox.com/v1/client-version/WindowsPlayer';
const MACOS_API_URL = 'https://clientsettings.roblox.com/v1/client-version/MacPlayer';

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
            return versionMatch[1];
          }
        }

        if (jsonData.softwareVersion) {
          const versionMatch = jsonData.softwareVersion.match(/([\d]+\.[\d]+\.[\d]+)/);
          if (versionMatch) {
            return versionMatch[1];
          }
        }

      }
    } catch (e) {}
  }

  const versionPattern = /Version[\s\S]{0,300}?(2\.\d{3}\.\d{3,4})/i;
  const versionMatch = html.match(versionPattern);

  if (versionMatch) {
    return versionMatch[1];
  }

  const whatsNewPattern = /"whatsNew"[\s\S]{0,500}?"version"[\s\S]{0,100}?"string"[\s\S]{0,100}?"([\d]+\.[\d]+\.[\d]+)"/i;
  const whatsNewMatch = html.match(whatsNewPattern);

  if (whatsNewMatch) {
    return whatsNewMatch[1];
  }

  const appStorePattern = /"versionDisplay"[\s\S]{0,100}?"([\d]+\.[\d]+\.[\d]+)"/i;
  const appStoreMatch = html.match(appStorePattern);

  if (appStoreMatch) {
    return appStoreMatch[1];
  }

  const robloxPattern = /(2\.\d{3}\.\d{3,4})/;
  const robloxMatch = html.match(robloxPattern);

  if (robloxMatch) {
    return robloxMatch[1];
  }

  throw new Error('iOS version not found');
}

async function fetchWindowsVersion() {
  const response = await fetch(WINDOWS_API_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response format from Windows API');
  }

  if (!data.version || typeof data.version !== 'string') {
    throw new Error('Version field missing or invalid in Windows API response');
  }

  return {
    version: data.version,
    clientVersionUpload: data.clientVersionUpload || null
  };
}

async function fetchMacosVersion() {
  const response = await fetch(MACOS_API_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response format from MacOS API');
  }

  if (!data.version || typeof data.version !== 'string') {
    throw new Error('Version field missing or invalid in MacOS API response');
  }

  return {
    version: data.version,
    clientVersionUpload: data.clientVersionUpload || null
  };
}

export default async function handler(req, res) {
  const platform = (req.query.platform || '').toLowerCase();

  if (!['android', 'ios', 'windows', 'macos'].includes(platform)) {
    return res.status(400).json({
      error: 'Invalid platform. Use android, ios, windows, or macos'
    });
  }

  try {
    let responseData;

    if (platform === 'android') {

      const version = await fetchAndroidVersion();
      responseData = { version };

    } else if (platform === 'ios') {

      const version = await fetchIosVersion();
      responseData = { version };

    } else if (platform === 'windows') {

      const windowsData = await fetchWindowsVersion();

      responseData = {
        version: windowsData.version
      };

      if (windowsData.clientVersionUpload) {
        responseData.clientVersionUpload = windowsData.clientVersionUpload;
      }

    } else if (platform === 'macos') {

      const macData = await fetchMacosVersion();

      responseData = {
        version: macData.version
      };

      if (macData.clientVersionUpload) {
        responseData.clientVersionUpload = macData.clientVersionUpload;
      }

    }

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.json(responseData);

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
