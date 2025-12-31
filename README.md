# Roblox Version API for Vercel

Simple API to fetch Roblox mobile versions for Android and iOS. Designed as Vercel Serverless Function.

## Endpoints
- `GET /api/version?platform=ios`
- `GET /api/version?platform=android`
- `GET /api/version/ios`
- `GET /api/version/android`

## Environment Variables
Set these in Vercel Project Settings -> Environment Variables:
- `PRIMARY_BASE` - primary API base URL (official Roblox API if available)
- `FALLBACK_BASE` - fallback/community API base URL
- `CACHE_TTL` - cache TTL in seconds (default 300)
- `RETRY_COUNT` - number of retries for HTTP requests (default 2)

## Notes
- Vercel serverless functions are ephemeral. In-memory cache may be cleared on cold starts. For production with stable caching, use an external cache (Redis, Upstash, etc).
- Adjust `PRIMARY_BASE` and `FALLBACK_BASE` to the real endpoints you will query. Confirm the response payload fields and update normalization if needed.
