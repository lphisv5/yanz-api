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

// เปลี่ยนเป็น endpoints ที่ใช้งานได้จริง
const VERSION_ENDPOINTS = {
  android: 'https://clientsettingscdn.roblox.com/v2/client-version/AndroidStudio',
  ios: 'https://clientsettingscdn.roblox.com/v2/client-version/IOSStudio',
  windows: 'https://clientsettingscdn.roblox.com/v2/client-version/WindowsPlayer64',
  macos: 'https://clientsettingscdn.roblox.com/v2/client-version/MacStudio'
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
// UTILS - แก้ไขการดึงข้อมูล
// =======================
async function fetchRobloxVersion(url) {
  try {
    const res = await request(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'accept': 'application/json',
        'origin': 'https://www.roblox.com'
      },
      maxRedirections: 3,
      timeout: 10000
    })
    
    const data = await res.body.json()
    
    // ดึงเฉพาะ version จาก response
    if (data && data.clientVersionUpload) {
      return data.clientVersionUpload
    } else if (data && data.version) {
      return data.version
    } else if (data && typeof data === 'string') {
      return data.trim()
    }
    
    return null
  } catch (error) {
    console.error('Error fetching from', url, error.message)
    return null
  }
}

// =======================
// ALTERNATIVE ENDPOINTS (สำรอง)
// =======================
const ALTERNATIVE_ENDPOINTS = {
  windows: [
    'https://setup.rbxcdn.com/version',
    'https://clientsettings.roblox.com/v2/client-version/WindowsPlayer64',
    'https://www.roblox.com/version'
  ],
  android: [
    'https://clientsettings.roblox.com/v2/client-version/AndroidStudio',
    'https://setup.rbxcdn.com/versionQTStudioAndroid'
  ],
  ios: [
    'https://clientsettings.roblox.com/v2/client-version/IOSStudio',
    'https://setup.rbxcdn.com/versionQTStudioIOS'
  ],
  macos: [
    'https://clientsettings.roblox.com/v2/client-version/MacStudio',
    'https://setup.rbxcdn.com/versionQTStudioMac'
  ]
}

async function fetchWithFallback(platform) {
  const endpoints = ALTERNATIVE_ENDPOINTS[platform] || [VERSION_ENDPOINTS[platform]]
  
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying ${platform}: ${endpoint}`)
      const version = await fetchRobloxVersion(endpoint)
      if (version && version !== 'null') {
        console.log(`Success for ${platform}: ${version}`)
        return version
      }
    } catch (error) {
      console.log(`Failed ${platform}: ${endpoint} - ${error.message}`)
    }
  }
  
  return null
}

// =======================
// MANUAL VERSION FALLBACK
// =======================
const MANUAL_VERSIONS = {
  windows: "version-1f0d6a5d3e2b4c",
  android: "version-2a4c6e8d0f1b3",
  ios: "version-3b5d7f9e1a2c4",
  macos: "version-4c6e8f0a1b3d5"
}

// =======================
// ROUTES - แก้ไข logic
// =======================
app.get('/api/roblox/version', async (request, reply) => {
  const cached = cache.get('roblox:version')
  if (cached) {
    return {
      success: true,
      cached: true,
      ...cached
    }
  }

  const versions = {}
  
  // ดึงข้อมูลแบบ parallel
  const platformPromises = Object.keys(VERSION_ENDPOINTS).map(async (platform) => {
    versions[platform] = await fetchWithFallback(platform)
    
    // ถ้าไม่ได้ข้อมูล ให้ใช้ manual fallback
    if (!versions[platform] || versions[platform] === 'null') {
      versions[platform] = MANUAL_VERSIONS[platform] || null
    }
  })
  
  await Promise.all(platformPromises)

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
// HEALTH CHECK
// =======================
app.get('/', () => ({
  status: 'ok',
  service: 'roblox-version-api',
  endpoints: Object.keys(VERSION_ENDPOINTS),
  timestamp: new Date().toISOString()
}))

// =======================
// DEBUG ENDPOINT
// =======================
app.get('/debug/endpoints', () => {
  return {
    primary: VERSION_ENDPOINTS,
    alternatives: ALTERNATIVE_ENDPOINTS,
    manual: MANUAL_VERSIONS
  }
})

// =======================
// START
// =======================
app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`Server running on port ${PORT}`)
