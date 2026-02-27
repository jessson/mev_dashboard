import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const WEB_HOST = process.env.WEB_HOST || '0.0.0.0';
const WEB_PORT = Number.parseInt(process.env.WEB_PORT || '8443', 10);

const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '';

const API_TARGET = process.env.API_TARGET || 'http://127.0.0.1:3000';
const apiTargetUrl = new URL(API_TARGET);

const FRONTEND_DIST_DIR =
  process.env.FRONTEND_DIST_DIR ||
  process.env.DIST_DIR ||
  path.resolve(process.cwd(), 'dist');

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function ensureFileExists(filePath, label) {
  if (!filePath) throw new Error(`${label} 未设置`);
  if (!fs.existsSync(filePath)) throw new Error(`${label} 文件不存在: ${filePath}`);
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.ico':
      return 'image/x-icon';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.txt':
      return 'text/plain; charset=utf-8';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function isCacheableAsset(urlPath) {
  return urlPath.startsWith('/assets/') || urlPath.includes('.');
}

function safeResolve(distDir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const normalized = decoded.replace(/\\/g, '/');
  const relative = normalized.replace(/^\/+/, '');
  const resolved = path.resolve(distDir, relative);
  if (!resolved.startsWith(path.resolve(distDir) + path.sep) && resolved !== path.resolve(distDir)) {
    return null;
  }
  return resolved;
}

function proxyHttp(req, res) {
  const upstreamLib = apiTargetUrl.protocol === 'https:' ? https : http;
  const upstreamHeaders = {
    ...req.headers,
    host: apiTargetUrl.host,
    'x-forwarded-host': req.headers.host || '',
    'x-forwarded-proto': 'https',
    'x-forwarded-for': req.socket.remoteAddress || '',
  };

  const upstreamReq = upstreamLib.request(
    {
      protocol: apiTargetUrl.protocol,
      hostname: apiTargetUrl.hostname,
      port: apiTargetUrl.port,
      method: req.method,
      path: req.url,
      headers: upstreamHeaders,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on('error', (err) => {
    res.statusCode = 502;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end(`Bad Gateway: ${err.message}`);
  });

  req.pipe(upstreamReq);
}

function handleStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Method Not Allowed');
    return;
  }

  const urlPath = req.url ? req.url.split('?')[0] : '/';
  const resolved = safeResolve(FRONTEND_DIST_DIR, urlPath || '/');
  if (!resolved) {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Bad Request');
    return;
  }

  let filePath = resolved;
  try {
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (stat && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      // SPA fallback
      filePath = path.join(FRONTEND_DIST_DIR, 'index.html');
    }

    const contentType = getContentType(filePath);
    res.setHeader('content-type', contentType);
    if (isCacheableAsset(urlPath || '/')) {
      res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('cache-control', 'no-cache');
    }

    if (req.method === 'HEAD') {
      res.statusCode = 200;
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Internal Server Error');
  }
}

function shouldProxy(urlPath) {
  return urlPath.startsWith('/api/') || urlPath === '/api' || urlPath.startsWith('/socket.io/');
}

function handleRequest(req, res) {
  const urlPath = req.url ? req.url.split('?')[0] : '/';
  if (urlPath && shouldProxy(urlPath)) {
    proxyHttp(req, res);
    return;
  }
  handleStatic(req, res);
}

function handleUpgrade(req, clientSocket, head) {
  const urlPath = req.url ? req.url.split('?')[0] : '/';
  if (!urlPath || !urlPath.startsWith('/socket.io/')) {
    clientSocket.destroy();
    return;
  }

  if (apiTargetUrl.protocol !== 'http:') {
    clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    clientSocket.destroy();
    return;
  }

  const upstreamSocket = net.connect(
    { host: apiTargetUrl.hostname, port: Number.parseInt(apiTargetUrl.port || '80', 10) },
    () => {
      const headers = Object.entries(req.headers)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\r\n');

      upstreamSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
      if (head && head.length > 0) upstreamSocket.write(head);

      clientSocket.pipe(upstreamSocket);
      upstreamSocket.pipe(clientSocket);
    }
  );

  upstreamSocket.on('error', () => {
    try {
      clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
    } finally {
      clientSocket.destroy();
    }
  });
}

ensureFileExists(SSL_CERT_PATH, 'SSL_CERT_PATH');
ensureFileExists(SSL_KEY_PATH, 'SSL_KEY_PATH');

if (!fs.existsSync(FRONTEND_DIST_DIR)) {
  throw new Error(`前端 dist 目录不存在: ${FRONTEND_DIST_DIR}`);
}

const server = https.createServer(
  {
    cert: fs.readFileSync(SSL_CERT_PATH),
    key: fs.readFileSync(SSL_KEY_PATH),
  },
  handleRequest
);

server.on('upgrade', handleUpgrade);

server.listen(WEB_PORT, WEB_HOST, () => {
  log(`Web网关启动: https://${WEB_HOST}:${WEB_PORT}`);
  log(`静态目录: ${FRONTEND_DIST_DIR}`);
  log(`反代目标: ${API_TARGET} (仅 /api/* 与 /socket.io/*)`);
  log(`前端建议：构建时设置 VITE_API_SAME_ORIGIN=1`);
});
