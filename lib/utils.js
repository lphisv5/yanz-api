// lib/utils.js
const axios = require('axios');

function normalizeVersion(v) {
  if (!v) return null;
  return String(v).trim();
}

function normalizeUpgradeAction(a) {
  if (!a) return null;
  return String(a).trim();
}

// Simple retry with exponential backoff for GET requests
async function retryRequest(url, axiosConfig = {}, retries = 2, backoffMs = 300) {
  let attempt = 0;
  while (true) {
    try {
      const r = await axios.get(url, axiosConfig);
      return r.data;
    } catch (err) {
      attempt++;
      if (attempt > retries) throw err;
      const wait = backoffMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

module.exports = {
  normalizeVersion,
  normalizeUpgradeAction,
  retryRequest
};
