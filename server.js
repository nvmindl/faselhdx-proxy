const express = require("express");
const https = require("https");

const app = express();

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const TARGET = "fasselhd.com";
const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36";

// Allowed PHP endpoints on fasselhd.com/page/
const ALLOWED = [
  "Movi_GET.php",
  "Serie_GET.php",
  "scriptApi.php",
  "related_movies.php",
  "related.php",
];

function proxyGet(path, query) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(query).toString();
    const fullPath = "/page/" + path + (qs ? "?" + qs : "");
    const opts = {
      hostname: TARGET,
      port: 443,
      path: fullPath,
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/html, */*",
        "Accept-Language": "ar,en;q=0.8",
        Referer: "https://" + TARGET + "/",
      },
      timeout: 15000,
    };

    const req = https.request(opts, (resp) => {
      let data = "";
      resp.on("data", (chunk) => (data += chunk));
      resp.on("end", () =>
        resolve({ status: resp.statusCode, body: data, headers: resp.headers })
      );
    });

    req.on("error", (e) => reject(e));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.end();
  });
}

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", version: "3.0.0", target: TARGET });
});

// Proxy: /api/:endpoint
app.get("/api/:endpoint", async (req, res) => {
  const endpoint = req.params.endpoint;
  if (!ALLOWED.includes(endpoint)) {
    return res.status(400).json({ error: "endpoint not allowed" });
  }
  try {
    const result = await proxyGet(endpoint, req.query);
    const ct = result.headers["content-type"];
    if (ct) res.set("Content-Type", ct);
    res.status(result.status).send(result.body);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Generic proxy: /proxy?url=<encoded URL>
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "url param required" });

  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: "invalid url" });
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "fasselhd.com" && host !== "fashd.com") {
    return res.status(403).json({ error: "host not allowed" });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const opts = {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          "Accept-Language": "ar,en;q=0.8",
          Referer: "https://" + parsed.hostname + "/",
        },
        timeout: 15000,
      };
      const r = https.request(opts, (resp) => {
        let data = "";
        resp.on("data", (c) => (data += c));
        resp.on("end", () =>
          resolve({ status: resp.statusCode, body: data, headers: resp.headers })
        );
      });
      r.on("error", reject);
      r.on("timeout", () => {
        r.destroy();
        reject(new Error("timeout"));
      });
      r.end();
    });
    const ct = result.headers["content-type"];
    if (ct) res.set("Content-Type", ct);
    res.status(result.status).send(result.body);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy listening on port " + PORT));
