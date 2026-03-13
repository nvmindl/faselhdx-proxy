# FaselHDX Cloudflare Proxy

Headless Chromium proxy with stealth plugin to bypass Cloudflare challenges for FaselHD.

## Deploy on Render.com (Free)

1. Go to [render.com](https://render.com) and sign up with GitHub
2. Click **New** → **Web Service**
3. Connect the `faselhdx-proxy` repo
4. Settings auto-detect from Dockerfile. Select **Free** plan.
5. Click **Deploy**

You'll get a URL like `https://faselhdx-proxy-xxxx.onrender.com`

## Endpoints

### GET /api/cookies?domain=web31312x.faselhdx.top
Returns CF clearance cookies for reuse.

### GET /api/fetch?url=ENCODED_URL
Full page fetch through Chromium. Optional: `&method=POST&body=ENCODED_BODY`

## Notes
- Free tier spins down after 15 min inactivity
- First request after sleep takes ~30s (cold start)
- Cookies cached 10 min across requests
