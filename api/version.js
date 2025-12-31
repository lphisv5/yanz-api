// api/version.js
const axios = require('axios');
const { normalizeVersion, normalizeUpgradeAction, retryRequest } = require('../lib/utils');

// Simple in-memory cache for serverless invocation lifetime
// Note: Vercel serverless functions are ephemeral; cache may not persist between cold starts.
const cache = new Map();
const DEFAULT_TTL = Number(process.env.CACHE_TTL || 300); // seconds

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value, ttl = DEFAULT_TTL) {
  cache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
}

async function fetchFromPrimary(platform) {
  const base = process.env.PRIMARY_BASE;
  if (!base) throw new Error('PRIMARY_BASE not configured');
  const url = `${base.replace(/\/$/, '')}/mobile/versions?platform=${platform}`;
  return retryRequest(url, { timeout: 8000 }, Number(process.env.RETRY_COUNT || 2));
}

async function fetchFromFallback(platform) {
  const base = process.env.FALLBACK_BASE;
  if (!base) throw new Error('FALLBACK_BASE not configured');
  const url = `${base.replace(/\/$/, '')}/mobile?platform=${platform}`;
  return retryRequest(url, { timeout: 8000 }, Number(process.env.RETRY_COUNT || 2));
}

module.exports = async function handler(req, res) {
  try {
    const platform = (req.query.platform || req.query.p || '').toString().toLowerCase() || (req.url.match(/\/api\/version\/(android|ios)/) || [])[1];
    if (!platform || !['android', 'ios'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be android or ios. Example: /api/version?platform=ios' });
    }

    const cacheKey = `roblox_ver_${platform}`;
    const cached = getCache(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    let raw = null;
    let source = null;

    // Try primary then fallback
    try {
      raw = await fetchFromPrimary(platform);
      source = 'primary';
    } catch (ePrimary) {
      try {
        raw = await fetchFromFallback(platform);
        source = 'fallback';
      } catch (eFallback) {
        console.error('Both primary and fallback failed', ePrimary?.message, eFallback?.message);
        return res.status(502).json({ error: 'failed to fetch version from all sources' });
      }
    }

    // Normalize common field names
    const version = normalizeVersion(raw.version || raw.clientVersion || raw.build || raw.appVersion || raw.versionString);
    const upgradeAction = normalizeUpgradeAction(raw.upgradeAction || raw.UpgradeAction || raw.mobileUpgradeAction || raw.upgrade);

    const out = {
      platform,
      version: version || null,
      upgradeAction: upgradeAction || null,
      source,
      rawSource: raw.source || raw.origin || null,
      fetchedAt: new Date().toISOString()
    };

    setCache(cacheKey, out, Number(process.env.CACHE_TTL || DEFAULT_TTL));
    return res.status(200).json(out);
  } catch (err) {
    console.error('Unhandled error in /api/version', err);
    return res.status(500).json({ error: 'internal server error', detail: err.message });
  }
};
