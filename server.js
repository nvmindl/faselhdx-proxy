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
  { host: "flech.tn", path: "/egybestantoo/public/api" },
  { host: "hrrejgh.com", path: "/wecima15/public/api" },
  { host: "www.hrrejhp.com", path: "/egybestanto/public/api" },
  { host: "fashd.com", path: "/faselhd15/public/api" },
];

var ALLOWED_HOSTS = [
  "uqload.net", "uqload.cx", "uqload.com", "uqload.to", "uqload.io", "uqload.is",
  "vidspeed.org", "vidspeed.cc",
  "dood.watch", "dood.to", "dood.so", "dood.pm", "dood.wf", "d0o0d.com",
  "streamtape.com", "streamtape.to",
  "mixdrop.co", "mixdrop.to", "mixdrop.sx",
  "upstream.to",
  "mp4upload.com",
  "streamwish.fun", "streamwish.com", "streamwish.to",
  "filemoon.sx", "filemoon.to",
  "earnvids.xyz",
  "updown.icu",
  "fasel-hd.cam", "www.fasel-hd.cam",
  "faselhd.cam", "www.faselhd.cam",
  "faselhd.center", "www.faselhd.center",
  "flech.tn",
  "egybestvid.com", "s1.egybestvid.com", "s2.egybestvid.com", "s3.egybestvid.com",
  "vidoba.org", "www.vidoba.org", "vidoba.site", "w.vidoba.site",
  "aflam.news", "v.aflam.news",
  "mp4plus.org", "www.mp4plus.org",
  "anafast.org", "www.anafast.org",
  "reviewrate.net", "m.reviewrate.net",
  "vidtube.one", "www.vidtube.one", "vidtube.cam", "www.vidtube.cam", "vidtube.pro", "www.vidtube.pro",
  "anafast.online", "www.anafast.online",
  "vidspeeds.com", "www.vidspeeds.com",
  "app.videas.fr", "videas.fr", "cdn.videas.fr", "cdn2.videas.fr",
  "1vid.xyz", "www.1vid.xyz",
  "lulustream.com", "www.lulustream.com",
  "luluvdo.com", "www.luluvdo.com",
  "luluvid.com", "www.luluvid.com",
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
  res.json({ status: "ok", version: "6.4.1", api: "EasyPlex" });
});

// Diagnostic: full chain test — embed → master m3u8 → variant m3u8 → first segment
app.get("/test-stream", function(req, res) {
  var embedUrl = req.query.url;
  if (!embedUrl) return res.status(400).json({ error: "url required" });
  var parsed;
  try { parsed = new URL(embedUrl); } catch(e) { return res.status(400).json({ error: "invalid url" }); }
  console.log("[test] embed: " + embedUrl.substring(0, 80));
  httpsGet(parsed.hostname, parsed.pathname + parsed.search, { Referer: "https://flech.tn/" })
    .then(function(embedResult) {
      var match = embedResult.body.match(/file:"(https:\/\/[^"]+\.m3u8[^"]*)"/);
      if (!match) return res.json({ step: "embed", error: "no m3u8 found", htmlLen: embedResult.body.length });
      var masterUrl = match[1];
      var masterParsed = new URL(masterUrl);
      var refDomain = masterParsed.hostname.replace(/^(s\d+|cdn\d*|edge\d*|stream\d*)\./, "");
      var refHeaders = { Referer: "https://" + refDomain + "/", Origin: "https://" + refDomain };
      console.log("[test] master: " + masterUrl.substring(0, 80));

      // Fetch master m3u8
      return httpsGet(masterParsed.hostname, masterParsed.pathname + masterParsed.search, refHeaders)
        .then(function(masterResult) {
          if (masterResult.status !== 200) return res.json({ step: "master", error: "status " + masterResult.status });
          var masterBody = masterResult.body;
          // Find first variant URL
          var lines = masterBody.split("\n");
          var variantUrl = null;
          var masterBase = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
          for (var li = 0; li < lines.length; li++) {
            var line = lines[li].trim();
            if (line && line.charAt(0) !== "#") {
              variantUrl = /^https?:\/\//i.test(line) ? line : masterBase + line;
              break;
            }
          }
          if (!variantUrl) return res.json({ step: "master", body: masterBody, error: "no variant url found" });

          var varParsed = new URL(variantUrl);
          console.log("[test] variant: " + variantUrl.substring(0, 80));

          // Fetch variant m3u8
          return httpsGet(varParsed.hostname, varParsed.pathname + varParsed.search, refHeaders)
            .then(function(varResult) {
              if (varResult.status !== 200) return res.json({ step: "variant", status: varResult.status, url: variantUrl });
              var varBody = varResult.body;
              // Find first .ts segment
              var varLines = varBody.split("\n");
              var segUrl = null;
              var varBase = variantUrl.substring(0, variantUrl.lastIndexOf("/") + 1);
              for (var vi = 0; vi < varLines.length; vi++) {
                var vl = varLines[vi].trim();
                if (vl && vl.charAt(0) !== "#") {
                  segUrl = /^https?:\/\//i.test(vl) ? vl : varBase + vl;
                  break;
                }
              }
              res.json({
                master_status: 200,
                master_lines: lines.length,
                variant_status: 200,
                variant_lines: varLines.length,
                first_segment: segUrl ? segUrl.substring(0, 120) : null,
              });
            });
        });
    })
    .catch(function(e) { res.json({ error: e.message }); });
});

var TMDB_KEY = "439c478a771f35c05022f9feabcca01c";

// Resolve TMDB ID to internal EasyPlex ID
// GET /resolve/movie/550  or  /resolve/tv/1396
app.get("/resolve/:type/:tmdbId", function(req, res) {
  var type = req.params.type;
  var tmdbId = req.params.tmdbId;
  if (!/^\d+$/.test(tmdbId)) return res.status(400).json({ error: "invalid tmdb id" });

  var tmdbPath = type === "tv"
    ? "/3/tv/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=en"
    : "/3/movie/" + tmdbId + "?api_key=" + TMDB_KEY + "&language=en";

  console.log("[resolve] " + type + " tmdb=" + tmdbId);

  // Step 1: Get title from TMDB
  httpsGet("api.themoviedb.org", tmdbPath).then(function(tmdbResult) {
    if (tmdbResult.status !== 200) {
      console.log("[resolve] TMDB returned " + tmdbResult.status);
      return res.status(404).json({ error: "tmdb lookup failed" });
    }
    var tmdbData;
    try { tmdbData = JSON.parse(tmdbResult.body); } catch(e) {
      return res.status(502).json({ error: "tmdb parse error" });
    }
    var title = tmdbData.title || tmdbData.name || tmdbData.original_title || tmdbData.original_name || "";
    if (!title) return res.status(404).json({ error: "no title from tmdb" });

    console.log("[resolve] TMDB title: " + title);

    // Step 2: Search EasyPlex by title
    var searchPath = "search/" + encodeURIComponent(title) + "/0";
    return apiRequest(searchPath).then(function(searchResult) {
      var searchData;
      try { searchData = JSON.parse(searchResult.body); } catch(e) {
        return res.status(502).json({ error: "search parse error" });
      }
      var items = searchData.search || searchData.data || [];
      if (Array.isArray(searchData)) items = searchData;

      // Find match by tmdb_id
      var match = null;
      for (var i = 0; i < items.length; i++) {
        if (String(items[i].tmdb_id) === String(tmdbId)) {
          match = items[i];
          break;
        }
      }
      if (!match) {
        console.log("[resolve] No match in " + items.length + " results for tmdb " + tmdbId);
        // Try original_title too
        var origTitle = tmdbData.original_title || tmdbData.original_name || "";
        if (origTitle && origTitle !== title) {
          console.log("[resolve] Retrying with original: " + origTitle);
          var searchPath2 = "search/" + encodeURIComponent(origTitle) + "/0";
          return apiRequest(searchPath2).then(function(sr2) {
            var sd2;
            try { sd2 = JSON.parse(sr2.body); } catch(e) { return res.status(404).json({ error: "not found" }); }
            var items2 = sd2.search || sd2.data || [];
            if (Array.isArray(sd2)) items2 = sd2;
            for (var j = 0; j < items2.length; j++) {
              if (String(items2[j].tmdb_id) === String(tmdbId)) {
                match = items2[j];
                break;
              }
            }
            if (!match) return res.status(404).json({ error: "not found", searched: title });
            console.log("[resolve] Found: internal=" + match.id + " title=" + match.title);
            res.json({ id: match.id, tmdb_id: match.tmdb_id, title: match.title, type: type });
          });
        }
        return res.status(404).json({ error: "not found", searched: title, results: items.length });
      }

      console.log("[resolve] Found: internal=" + match.id + " title=" + match.title);
      res.json({ id: match.id, tmdb_id: match.tmdb_id, title: match.title, type: type });
    });
  }).catch(function(e) {
    console.log("[resolve] error: " + e.message);
    res.status(502).json({ error: e.message });
  });
});

app.get("/api/*", function(req, res) {
  var endpoint = req.params[0];
  if (!endpoint) return res.status(400).json({ error: "no endpoint" });
  if (!/^[\w\/\-\.%\+\s]+$/.test(endpoint)) {
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

// Stream proxy — proxies HLS manifests (rewriting URLs) and media segments
// This is needed because egybestvid/uqload m3u8 tokens are IP-locked to the server that fetched the embed page
app.get("/stream", function(req, res) {
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

  var proxyBase = "https://" + req.get("host");
  var isM3u8 = /\.m3u8/i.test(parsed.pathname);

  // Derive the base domain for Referer (strip CDN subdomains like s1., s2., etc.)
  var refDomain = parsed.hostname.replace(/^(s\d+|cdn\d*|edge\d*|stream\d*)\./, "");
  var refOrigin = "https://" + refDomain;

  console.log("[stream] " + (isM3u8 ? "m3u8" : "seg") + " " + url.substring(0, 100));

  var reqOpts = {
    hostname: parsed.hostname, port: 443,
    path: parsed.pathname + parsed.search,
    method: "GET",
    headers: { "User-Agent": UA, "Accept": "*/*", Referer: refOrigin + "/", Origin: refOrigin },
    timeout: 30000,
  };

  var proxyReq = https.request(reqOpts, function(upstreamRes) {
    // Follow redirects
    if ([301,302,303,307,308].indexOf(upstreamRes.statusCode) >= 0 && upstreamRes.headers.location) {
      upstreamRes.resume();
      var newUrl = upstreamRes.headers.location;
      if (!/^https?:\/\//i.test(newUrl)) newUrl = "https://" + parsed.hostname + newUrl;
      return res.redirect(307, proxyBase + "/stream?url=" + encodeURIComponent(newUrl));
    }

    if (upstreamRes.statusCode !== 200) {
      upstreamRes.resume();
      return res.status(upstreamRes.statusCode).json({ error: "upstream " + upstreamRes.statusCode });
    }

    var ct = upstreamRes.headers["content-type"] || "";

    if (isM3u8 || ct.indexOf("mpegurl") >= 0) {
      // M3U8 manifest — buffer, rewrite URLs, send
      var data = "";
      upstreamRes.setEncoding("utf8");
      upstreamRes.on("data", function(chunk) { data += chunk; });
      upstreamRes.on("end", function() {
        var baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
        var lines = data.split("\n");
        var out = [];
        for (var li = 0; li < lines.length; li++) {
          var line = lines[li];
          var trimmed = line.trim();
          if (!trimmed) { out.push(line); continue; }
          // Rewrite URI="" in #EXT tags (encryption keys, maps)
          if (trimmed.charAt(0) === "#") {
            out.push(trimmed.replace(/URI="([^"]+)"/gi, function(match, uri) {
              var absUri = /^https?:\/\//i.test(uri) ? uri : baseUrl + uri;
              return 'URI="' + proxyBase + '/stream?url=' + encodeURIComponent(absUri) + '"';
            }));
            continue;
          }
          // URL line (segment, variant playlist)
          if (/^https?:\/\//i.test(trimmed)) {
            out.push(proxyBase + "/stream?url=" + encodeURIComponent(trimmed));
          } else {
            out.push(proxyBase + "/stream?url=" + encodeURIComponent(baseUrl + trimmed));
          }
        }
        res.set("Content-Type", "application/vnd.apple.mpegurl");
        res.send(out.join("\n"));
      });
    } else {
      // Binary segment — pipe through
      res.set("Content-Type", ct || "application/octet-stream");
      if (upstreamRes.headers["content-length"]) {
        res.set("Content-Length", upstreamRes.headers["content-length"]);
      }
      upstreamRes.pipe(res);
    }
  });
  proxyReq.on("error", function(e) {
    console.log("[stream] error: " + e.message);
    res.status(502).json({ error: e.message });
  });
  proxyReq.on("timeout", function() { proxyReq.destroy(); });
  proxyReq.end();
});

// Extract video sources from embed pages (JWPlayer, direct URLs)
// Returns JSON array of {url, quality, type}

// Unpack Dean Edwards p.a.c.k.e.r. obfuscated JS
function unpackPacker(html) {
  // Match p.a.c.k.e.r: eval(function(p,a,c,k,e,d){...}('packed',base,count,'dict'.split('|')))
  // The packed string may contain escaped quotes like \" so we use a greedy match up to ',\d+,\d+,'
  var match = html.match(/eval\(function\(p,a,c,k,e,d\)\{[^}]+\}\('((?:[^\\']|\\.)*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']*)'\s*\.split\('\|'\)/);
  if (!match) return null;
  var p = match[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
  var a = parseInt(match[2]), c = parseInt(match[3]), k = match[4].split("|");
  function baseN(num, radix) {
    var digits = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (num < radix) return digits[num];
    return baseN(Math.floor(num / radix), radix) + digits[num % radix];
  }
  while (c--) {
    if (k[c]) {
      var token = baseN(c, a);
      p = p.replace(new RegExp("\\b" + token + "\\b", "g"), k[c]);
    }
  }
  return p;
}

app.get("/extract", function(req, res) {
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

  console.log("[extract] " + url.substring(0, 100));

  // Follow redirects (aflam.news → mp4plus.org, lulustream → luluvdo)
  httpsGet(parsed.hostname, parsed.pathname + parsed.search, {
    Referer: parsed.origin + "/",
  }, 5).then(function(result) {
    if (result.status !== 200) {
      return res.json({ sources: [], error: "status " + result.status });
    }
    var sources = extractSourcesFromHtml(result.body);
    console.log("[extract] Found " + sources.length + " sources");
    res.json({ sources: sources });
  }).catch(function(e) {
    console.log("[extract] error: " + e.message);
    res.status(502).json({ sources: [], error: e.message });
  });
});

// Helper: extract video sources from HTML string
function extractSourcesFromHtml(html) {
  var sources = [];

  // Try to unpack p.a.c.k.e.r. obfuscated JS first (vidtube.one etc)
  var unpacked = unpackPacker(html);
  var searchText = unpacked || html;

  // Extract JWPlayer sources: sources: [{file:"...",label:"..."}]
  var jwMatch = searchText.match(/sources\s*:\s*\[([^\]]+)\]/);
  if (jwMatch) {
    var srcBlock = jwMatch[1];
    var fileRe = /\{[^}]*file\s*:\s*"([^"]+)"[^}]*(?:label\s*:\s*"([^"]*)"|)[^}]*\}/gi;
    var fm;
    while ((fm = fileRe.exec(srcBlock)) !== null) {
      var fileUrl = fm[1];
      var label = fm[2] || "auto";
      var type = /\.m3u8/i.test(fileUrl) ? "m3u8" : "mp4";
      sources.push({ url: fileUrl, quality: label, type: type });
    }
  }

  // Fallback: scan for any m3u8/mp4 URLs in both original and unpacked
  if (!sources.length) {
    var scanText = unpacked ? unpacked + "\n" + html : html;
    var m3re = /https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/gi;
    var m3m;
    while ((m3m = m3re.exec(scanText)) !== null) {
      sources.push({ url: m3m[0], quality: "auto", type: "m3u8" });
    }
    var mp4re = /https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?/gi;
    var mp4m;
    while ((mp4m = mp4re.exec(scanText)) !== null) {
      var q = "auto";
      if (/1080/.test(mp4m[0])) q = "1080p";
      else if (/720/.test(mp4m[0])) q = "720p";
      else if (/480/.test(mp4m[0])) q = "480p";
      else if (/360|320/.test(mp4m[0])) q = "360p";
      sources.push({ url: mp4m[0], quality: q, type: "mp4" });
    }
  }

  // Deduplicate
  var seen = {};
  sources = sources.filter(function(s) {
    if (seen[s.url]) return false;
    seen[s.url] = true;
    return true;
  });

  return sources;
}

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
app.listen(PORT, function() { console.log("FaselHDX proxy v6.4.1 on port " + PORT); });

module.exports = app;
