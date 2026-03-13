# faselhdx-proxy

Vercel serverless proxy that solves Cloudflare challenges for FaselHD.

## Endpoints

### `GET /api/cookies?domain=web31312x.faselhdx.top`
Solves CF challenge and returns cookies. Caches for 10 min on warm instances.

### `GET /api/fetch?url=https://web31312x.faselhdx.top/...`
Fetches a page through headless Chromium, solves CF, returns HTML.

For POST: `?url=...&method=POST&body=action%3Ddtc_live%26trsearch%3Dtest`

## Deploy

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel` (follow prompts, select Hobby/free plan)
3. Note your deployment URL (e.g. `faselhdx-proxy-xxx.vercel.app`)
4. Set that URL in the FaselHDX provider's `PROXY_BASE`

## Limits (free tier)
- 100GB-hours/month compute
- 100k invocations/month  
- 10s default / 30s max function timeout
