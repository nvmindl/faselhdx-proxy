const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";
const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 " +
  "Mobile/15E148 Safari/604.1";

// Cookie cache
let cachedCookies = null;
let cachedUA = UA;
let cookieAge = 0;
const COOKIE_TTL = 10 * 60 * 1000;

const ALLOWED_HOSTS = [
  "faselhdx.top",
  "fasel-hd.cam",
  "faselhds.biz",
  "faselhd.club",
  "faselhd.pro",
];

function isAllowed(hostname) {
  const h = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((d) => h === d || h.endsWith("." + d));
}

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
      "--disable-extensions",
    ],
    defaultViewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
  });
}

async function waitForCF(page) {
  try {
    await page.waitForFunction(
      () =>
        !document.querySelector("#challenge-running") &&
        !document.querySelector("#challenge-stage") &&
        !document.title.includes("Just a moment"),
      { timeout: 20000 }
    );
    await new Promise((r) => setTimeout(r, 1500));
  } catch {
    // timeout — CF challenge didn't clear
  }
}

// ── /api/cookies ─────────────────────────────────────────────────────────

app.get("/api/cookies", async (req, res) => {
  const domain = req.query.domain || "web31312x.faselhdx.top";

  if (cachedCookies && Date.now() - cookieAge < COOKIE_TTL) {
    return res.json({
      cookies: cachedCookies,
      ua: cachedUA,
      cached: true,
      age: Math.round((Date.now() - cookieAge) / 1000),
    });
  }

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(UA);

    await page.goto("https://" + domain + "/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    await waitForCF(page);

    const cookies = await page.cookies();
    const cfCookies = cookies
      .filter((c) => c.name === "cf_clearance" || c.name.startsWith("__cf"))
      .map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
      }));

    cachedCookies = cfCookies;
    cachedUA = UA;
    cookieAge = Date.now();

    res.json({ cookies: cfCookies, ua: UA, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

// ── /api/fetch ───────────────────────────────────────────────────────────

app.get("/api/fetch", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "Missing 'url'" });

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }
  if (!isAllowed(parsed.hostname)) {
    return res.status(403).json({ error: "Domain not allowed" });
  }

  const method = req.query.method || "GET";
  const postBody = req.query.body || null;

  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(UA);

    if (cachedCookies && Date.now() - cookieAge < COOKIE_TTL) {
      const cookieObjs = cachedCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || parsed.hostname,
        path: c.path || "/",
      }));
      await page.setCookie(...cookieObjs);
    }

    if (method === "POST" && postBody) {
      await page.setRequestInterception(true);
      let intercepted = false;
      page.on("request", (r) => {
        if (!intercepted) {
          intercepted = true;
          r.continue({
            method: "POST",
            postData: postBody,
            headers: {
              ...r.headers(),
              "content-type": "application/x-www-form-urlencoded",
              "x-requested-with": "XMLHttpRequest",
            },
          });
        } else {
          r.continue();
        }
      });
    }

    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    const status = response ? response.status() : 0;
    if (status === 403 || status === 503) await waitForCF(page);

    const allCookies = await page.cookies();
    cachedCookies = allCookies
      .filter((c) => c.name === "cf_clearance" || c.name.startsWith("__cf"))
      .map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
      }));
    cookieAge = Date.now();

    const html = await page.content();

    res.json({
      html,
      url: page.url(),
      status,
      cookies: allCookies
        .filter((c) => c.name === "cf_clearance")
        .map((c) => c.name + "=" + c.value),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

// ── Health check ─────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "faselhdx-proxy" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy running on port " + PORT));
