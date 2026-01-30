const ANDROID_URL = 'https://roblox.en.uptodown.com/android';
const IOS_URL = 'https://apps.apple.com/us/app/roblox/id431946152';
const WINDOWS_VERSION_URL = 'https://setup.rbxcdn.com/version';
const DEPLOY_HISTORY_URL = 'https://setup.rbxcdn.com/DeployHistory.txt';

const UA = {
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
};

async function fetchAndroidVersion() {
  const res = await fetch(ANDROID_URL, UA);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const m = html.match(/Version\s*([\d.]+)/i);
  if (!m) throw new Error('Android version not found');
  return m[1];
}

async function fetchIosVersion() {
  const res = await fetch(IOS_URL, UA);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const scriptRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m;

  while ((m = scriptRegex.exec(html))) {
    try {
      const json = JSON.parse(m[1]);
      if (json.softwareVersion) {
        return json.softwareVersion;
      }
    } catch {}
  }

  const fallback = html.match(/Version\s*([\d.]+)/i);
  if (fallback) return fallback[1];

  throw new Error('iOS version not found');
}

async function fetchWindowsVersion() {
  const res = await fetch(WINDOWS_VERSION_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const v = (await res.text()).trim();

  if (!/^\d+\.\d+\.\d+\.\d+$/.test(v)) {
    throw new Error('Invalid Windows version');
  }
  return v;
}

async function fetchClientVersionUpload() {
  const res = await fetch(DEPLOY_HISTORY_URL);
  if (!res.ok) return null;

  const lines = (await res.text()).split('\n').filter(Boolean);
  const m = lines[0]?.match(/version-([a-f0-9]+)/);
  return m ? `version-${m[1]}` : null;
}

export default async function handler(req, res) {
  const platform = (req.query.platform || '').toLowerCase();
  if (!['android', 'ios', 'windows'].includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }

  try {
    let version;
    let clientVersionUpload;

    if (platform === 'android') version = await fetchAndroidVersion();
    if (platform === 'ios') version = await fetchIosVersion();
    if (platform === 'windows') {
      version = await fetchWindowsVersion();
      clientVersionUpload = await fetchClientVersionUpload();
    }

    res.setHeader('Cache-Control', 's-maxage=600');
    res.json({ platform, version, clientVersionUpload });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
