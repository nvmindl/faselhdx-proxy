const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// Simple in-memory cookie cache (per cold-start instance)
let cachedCookies = null;
let cookieAge = 0;
const COOKIE_TTL = 10 * 60 * 1000; // 10 minutes

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const targetUrl = req.query.url || req.body?.url;
  if (!targetUrl) {
    res.status(400).json({ error: "Missing 'url' parameter" });
    return;
  }

  // Only allow FaselHD domains
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  const host = parsed.hostname.toLowerCase();
  const allowed =
    host.endsWith("faselhdx.top") ||
    host.endsWith("fasel-hd.cam") ||
    host.endsWith("faselhds.biz") ||
    host.endsWith("faselhd.club") ||
    host.endsWith("faselhd.pro");
  if (!allowed) {
    res.status(403).json({ error: "Domain not allowed" });
    return;
  }

  // POST body forwarding
  const method = req.query.method || "GET";
  const postBody = req.query.body || req.body?.body || null;

  let browser = null;
  try {
    chromium.setHeadlessMode = true;
    chromium.setGraphicsMode = false;

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) " +
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 " +
        "Mobile/15E148 Safari/604.1"
    );

    // Restore cached cookies if still fresh
    if (cachedCookies && Date.now() - cookieAge < COOKIE_TTL) {
      await page.setCookie(...cachedCookies);
    }

    if (method === "POST" && postBody) {
      // For POST requests, intercept and modify
      await page.setRequestInterception(true);
      let intercepted = false;
      page.on("request", (interceptedReq) => {
        if (!intercepted) {
          intercepted = true;
          interceptedReq.continue({
            method: "POST",
            postData: postBody,
            headers: {
              ...interceptedReq.headers(),
              "content-type": "application/x-www-form-urlencoded",
              "x-requested-with": "XMLHttpRequest",
            },
          });
        } else {
          interceptedReq.continue();
        }
      });
    }

    // Navigate and wait for CF to clear
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    const status = response ? response.status() : 0;

    // If we hit a CF challenge page, wait for it to resolve
    if (status === 403 || status === 503) {
      await page.waitForFunction(
        () => {
          return (
            !document.querySelector("#challenge-running") &&
            !document.querySelector("#challenge-stage") &&
            !document.title.includes("Just a moment")
          );
        },
        { timeout: 20000 }
      );
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Cache the cookies for subsequent requests
    cachedCookies = await page.cookies();
    cookieAge = Date.now();

    const html = await page.content();
    const finalUrl = page.url();

    res.status(200).json({
      html: html,
      url: finalUrl,
      status: status,
      cookies: cachedCookies
        .filter((c) => c.name === "cf_clearance")
        .map((c) => c.name + "=" + c.value),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};
