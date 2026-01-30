const WINDOWS_VERSION_URL = 'https://setup.rbxcdn.com/version';
const DEPLOY_HISTORY_URL = 'https://setup.rbxcdn.com/DeployHistory.txt';

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
  try {
    const version = await fetchWindowsVersion();
    const clientVersionUpload = await fetchClientVersionUpload();
    
    const responseData = {
      version,
      platform: 'windows',
    };
    
    if (clientVersionUpload) {
      responseData.clientVersionUpload = clientVersionUpload;
    }
    
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.json(responseData);
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
