var express = require("express");
var https = require("https");

var app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

var API_BASES = [
  { host: "hrrejgh.com", path: "/wecima15/public/api" },
  { host: "www.hrrejhp.com", path: "/egybestanto/public/api" },
  { host: "fashd.com", path: "/faselhd15/public/api" },
];

var ALLOWED_HOSTS = [
  "uqload.net", "uqload.cx", "uqload.com", "uqload.to",
  "vidspeed.org", "vidspeed.cc",
  "dood.watch", "dood.to", "dood.so", "dood.pm", "dood.wf",
  "streamtape.com", "streamtape.to",
  "mixdrop.co", "mixdrop.to", "mixdrop.sx",
  "upstream.to",
  "mp4upload.com",
  "fasel-hd.cam", "www.fasel-hd.cam",
  "faselhd.cam", "www.faselhd.cam",
];

var UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36";

function httpsGet(hostname, path, extraHeaders, maxRedirects) {
  maxRedirects = maxRedirects || 5;
  return new Promise(function(resolve, reject) {
    var hdrs = {
      "User-Agent": UA,
      "Accept": "application/json, text/html, */*",
      "Accept-Language": "ar,en;q=0.8",
    };
    if (extraHeaders) {
      var keys = Object.keys(extraHeaders);
      for (var i = 0; i < keys.length; i++) hdrs[keys[i]] = extraHeaders[keys[i]];
    }
    var opts = {
      hostname: hostname,
      port: 443,
      path: path,
      method: "GET",
      headers: hdrs,
      timeout: 20000,
    };
    var req = https.request(opts, function(resp) {
      if ([301, 302, 303, 307, 308].indexOf(resp.statusCode) >= 0 && resp.headers.location && maxRedirects > 0) {
        var loc = resp.headers.location;
        try {
          var u = new URL(loc, "https://" + hostname);
          resp.resume();
          return httpsGet(u.hostname, u.pathname + u.search, extraHeaders, maxRedirects - 1).then(resolve, reject);
        } catch (e) {}
      }
      var data = "";
      resp.on("data", function(chunk) { data += chunk; });
      resp.on("end", function() {
        resolve({ status: resp.statusCode, body: data, headers: resp.headers });
      });
    });
    req.on("error", function(e) { reject(e); });
    req.on("timeout", function() { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

function apiRequest(endpoint) {
  var idx = 0;
  function tryNext() {
    if (idx >= API_BASES.length) return Promise.reject(new Error("all backends failed"));
    var base = API_BASES[idx];
    idx++;
    var fullPath = base.path + "/" + endpoint;
    console.log("[api] try " + base.host + fullPath);
    return httpsGet(base.host, fullPath).then(function(result) {
      if (result.status === 200) {
        try {
          var body = result.body.trim();
          if (body === '"Non autoris\\u00e9"' || body === '"Merci"' || body === '"Non autorise\\u0301"') {
            console.log("[api] auth rejected by " + base.host);
            return tryNext();
          }
        } catch (e) {}
        return result;
      }
      console.log("[api] " + base.host + " status " + result.status);
      return tryNext();
    }).catch(function(e) {
      console.log("[api] " + base.host + " error: " + e.message);
      return tryNext();
    });
  }
  return tryNext();
}

app.get("/", function(req, res) {
  res.json({ status: "ok", version: "4.0.0", api: "EasyPlex" });
});

app.get("/api/*", function(req, res) {
  var endpoint = req.params[0];
  if (!endpoint) return res.status(400).json({ error: "no endpoint" });
  if (!/^[\w\/\-\.%]+$/.test(endpoint)) {
    return res.status(400).json({ error: "invalid endpoint" });
  }
  console.log("[proxy] /api/" + endpoint);
  apiRequest(endpoint).then(function(result) {
    var ct = result.headers["content-type"];
    if (ct) res.set("Content-Type", ct);
    res.status(result.status).send(result.body);
  }).catch(function(e) {
    console.log("[proxy] error: " + e.message);
    res.status(502).json({ error: e.message });
  });
});

app.get("/embed", function(req, res) {
  var url = req.query.url;
  if (!url) return res.status(400).json({ error: "url required" });
  var parsed;
  try { parsed = new URL(url); } catch (e) { return res.status(400).json({ error: "invalid url" }); }

  var host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  var allowed = false;
  for (var i = 0; i < ALLOWED_HOSTS.length; i++) {
    if (host === ALLOWED_HOSTS[i] || host === "www." + ALLOWED_HOSTS[i]) { allowed = true; break; }
  }
  if (!allowed) return res.status(403).json({ error: "host not allowed: " + host });

  console.log("[embed] " + url.substring(0, 80));
  httpsGet(parsed.hostname, parsed.pathname + parsed.search, {
    Referer: parsed.origin + "/",
  }).then(function(result) {
    var ct = result.headers["content-type"];
    if (ct) res.set("Content-Type", ct);
    res.status(result.status).send(result.body);
  }).catch(function(e) {
    console.log("[embed] error: " + e.message);
    res.status(502).json({ error: e.message });
  });
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log("FaselHDX proxy v4.0.0 on port " + PORT); });
