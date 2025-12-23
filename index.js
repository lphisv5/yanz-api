import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import NodeCache from 'node-cache'
import { request } from 'undici'

const app = Fastify({
  logger: true,
  trustProxy: true
})

// =======================
// CONFIG
// =======================
const PORT = process.env.PORT || 3000
const CACHE_TTL = 600 // 10 นาที

const VERSION_ENDPOINTS = {
  android: 'https://setup.roblox.com/versionQTStudioAndroid',
  ios: 'https://setup.roblox.com/versionQTStudioIOS',
  windows: 'https://setup.roblox.com/version',
  macos: 'https://setup.roblox.com/versionQTStudioMac'
}

// =======================
// PLUGINS
// =======================
await app.register(rateLimit, {
  max: 60,
  timeWindow: '1 minute'
})

const cache = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: 120
})

// =======================
// UTILS
// =======================
async function fetchText(url) {
  const res = await request(url, {
    headers: {
      'user-agent': 'Roblox-Version-API/1.0'
    },
    maxRedirections: 3
  })
  return (await res.body.text()).trim()
}

// =======================
// ROUTES
// =======================
app.get('/api/roblox/version', async () => {
  const cached = cache.get('roblox:version')
  if (cached) {
    return {
      success: true,
      cached: true,
      ...cached
    }
  }

  const versions = {}

  for (const [platform, url] of Object.entries(VERSION_ENDPOINTS)) {
    try {
      versions[platform] = await fetchText(url)
    } catch {
      versions[platform] = null
    }
  }

  const payload = {
    updated: new Date().toISOString(),
    versions
  }

  cache.set('roblox:version', payload)

  return {
    success: true,
    cached: false,
    ...payload
  }
})

// =======================
// HEALTH CHECK (Render ใช้)
// =======================
app.get('/', () => ({
  status: 'ok',
  service: 'roblox-version-api'
}))

// =======================
// START
// =======================
app.listen({ port: PORT, host: '0.0.0.0' })
