const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// Cached CF cookies shared across warm invocations
let cachedCookies = null;
let cachedUA = "";
let cookieAge = 0;
const COOKIE_TTL = 10 * 60 * 1000; // 10 min

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const domain = req.query.domain || "web31312x.faselhdx.top";

  // Return cached cookies if still fresh
  if (cachedCookies && Date.now() - cookieAge < COOKIE_TTL) {
    res.status(200).json({
      cookies: cachedCookies,
      ua: cachedUA,
      cached: true,
      age: Math.round((Date.now() - cookieAge) / 1000),
    });
    return;
  }

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
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 " +
      "Mobile/15E148 Safari/604.1";
    await page.setUserAgent(ua);

    await page.goto("https://" + domain + "/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // Wait for CF challenge to clear
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

    const cookies = await page.cookies();
    const cfCookies = cookies
      .filter(
        (c) => c.name === "cf_clearance" || c.name.startsWith("__cf")
      )
      .map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
      }));

    cachedCookies = cfCookies;
    cachedUA = ua;
    cookieAge = Date.now();

    res.status(200).json({
      cookies: cfCookies,
      ua: ua,
      cached: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};
