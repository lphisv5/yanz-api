// api/version.js
const axios = require('axios');

function normalizeVersion(v) {
  if (!v) return null;
  return String(v).trim();
}

function normalizeUpgradeAction(a) {
  if (!a) return null;
  return String(a).trim();
}

module.exports = async function handler(req, res) {
  try {
    const platform = (req.query.platform || '').toLowerCase();
    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be android or ios' });
    }

    // เรียก Roblox official endpoint
    const url = `https://apis.roblox.com/client-settings/v1/upgrade?platform=${platform}`;
    const response = await axios.get(url, { timeout: 8000 });
    const data = response.data;

    const version = normalizeVersion(data.version || data.clientVersion || data.build);
    const upgradeAction = normalizeUpgradeAction(data.upgradeAction || data.UpgradeAction);

    return res.status(200).json({
      platform,
      version,
      upgradeAction,
      fetchedAt: new Date().toISOString(),
      source: url
    });
  } catch (err) {
    console.error('Error fetching Roblox version:', err.message);
    return res.status(502).json({ error: 'failed to fetch version', detail: err.message });
  }
};
