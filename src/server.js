// wt-map/server.js
// 战雷本地战术地图：把游戏自带的 8111 端口数据代理给平板浏览器
// 额外提供 /ip 页面（大字地址 + 二维码）与 /api/status

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.PORT || 8112);
const WT = (process.env.WT_API_BASE || 'http://127.0.0.1:8111').replace(/\/$/, '');
const ROOT = __dirname;
const ERRLOG = path.join(ROOT, 'server.err.log');

process.on('uncaughtException', (e) => log('uncaught: ' + ((e && e.stack) || e)));
process.on('unhandledRejection', (e) => log('unhandled: ' + ((e && e.stack) || e)));

function log(msg) {
  try {
    const line = new Date().toISOString() + '  ' + msg + '\n';
    if (fs.existsSync(ERRLOG) && fs.statSync(ERRLOG).size > 256 * 1024) fs.unlinkSync(ERRLOG);
    fs.appendFileSync(ERRLOG, line);
  } catch (_) {}
}

/* ---------- 记录最近访问的局域网客户端（用来判断平板是否已接入） ---------- */
const seen = new Map();
function touch(ip) {
  if (!ip) return;
  const clean = ip.replace(/^::ffff:/, '');
  if (clean === '127.0.0.1' || clean === '::1') return;
  seen.set(clean, Date.now());
}
function clients(withinMs) {
  const now = Date.now(), out = [];
  for (const [ip, t] of seen) {
    if (now - t <= withinMs) out.push(ip);
    else seen.delete(ip);
  }
  return out;
}

function lanIPs() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) out.push({ name, ip: a.address });
    }
  }
  out.sort((x, y) => (x.name === 'WLAN' ? -1 : 1));
  return out;
}

/* ---------- /ip 页面 ---------- */
function ipPage() {
  const list = lanIPs();
  const primary = (list[0] && list[0].ip) || '127.0.0.1';
  const url = `http://${primary}:${PORT}/`;
  const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=' + encodeURIComponent(url);
  const alt = list.map(x => `${x.ip} (${x.name})`).join(' · ');
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>平板连接</title>
<style>
 body{margin:0;min-height:100vh;background:#0b0f0c;color:#d8eccf;
      font-family:system-ui,"Microsoft YaHei",sans-serif;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px}
 .h{font-size:15px;opacity:.6;letter-spacing:2px}
 .url{font-size:clamp(24px,4vw,54px);font-weight:700;color:#fff;background:#121a12;
      border:1px solid #2a3a26;border-radius:14px;padding:12px 26px;font-variant-numeric:tabular-nums}
 .qr{background:#fff;padding:10px;border-radius:12px;line-height:0}
 .st{font-size:15px}
 .st.ok{color:#7ee08a}.st.no{color:#ffb454}
 .tip{font-size:13px;opacity:.5;max-width:640px;text-align:center;line-height:1.7}
 code{background:#121a12;padding:1px 6px;border-radius:5px}
</style></head><body>
<div class="h">平板浏览器打开这个地址（或扫码）</div>
<div class="url">${url}</div>
<div class="st no" id="st">等待平板接入…</div>
<div class="qr"><img src="${qr}" width="300" height="300" alt="二维码（需联网生成）"></div>
<div class="tip">扫描二维码可直接进入。接入成功后这里会变绿。<br>
本机所有地址：${alt}<br>
IP 由路由器分配，重启路由器后可能变化，重新打开快捷方式即可刷新。</div>
<script>
async function tick(){
  try{
    const r = await fetch('/api/status', {cache:'no-store'});
    const j = await r.json();
    const el = document.getElementById('st');
    if (j.clients > 0){ el.className='st ok'; el.textContent='平板已接入 ✓  ' + j.clientList.join(', '); }
    else { el.className='st no'; el.textContent='等待平板接入…'; }
  }catch(e){}
}
setInterval(tick, 1000); tick();
</script>
</body></html>`;
}

/* ---------- 代理 ---------- */
function fail(res, msg) {
  try {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: msg }));
  } catch (_) { try { res.destroy(); } catch (_) {} }
}

function proxy(req, res) {
  res.on('error', () => {});
  req.on('error', () => {});
  const target = WT + req.url.replace(/^\/api/, '');
  const r = http.get(target, { timeout: 2500 }, (up) => {
    up.on('error', () => { try { res.destroy(); } catch (_) {} });
    try {
      res.writeHead(up.statusCode || 200, {
        'Content-Type': up.headers['content-type'] || 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
    } catch (_) { try { up.destroy(); } catch (_) {} return; }
    up.pipe(res);
  });
  r.on('timeout', () => { try { r.destroy(); } catch (_) {} fail(res, 'upstream timeout'); });
  r.on('error', (e) => fail(res, 'upstream error: ' + e.message));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  res.on('error', () => {});
  touch(req.socket && req.socket.remoteAddress);

  const p0 = req.url.split('?')[0];

  if (p0 === '/ip') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(ipPage());
  }

  if (p0 === '/api/status') {
    const list = clients(15000);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, clients: list.length, clientList: list, lan: lanIPs() }));
  }

  if (req.url.startsWith('/api/')) return proxy(req, res);

  let p = p0;
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  fs.readFile(file, (err, buf) => {
    if (err) { try { res.writeHead(404); res.end('not found'); } catch (_) {} return; }
    try {
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(buf);
    } catch (_) {}
  });
});

server.on('error', (e) => {
  if (e && e.code === 'EADDRINUSE') { log('port busy, another instance running; exit 0'); process.exit(0); }
  log('server error: ' + (e && e.message));
  process.exit(0);
});

server.on('clientError', (err, socket) => { try { socket.destroy(); } catch (_) {} });

server.listen(PORT, '0.0.0.0', () => {
  log(`server started on ${PORT}  upstream=${WT}  pid=${process.pid}` + '  ' + lanIPs().map(x => x.ip).join(', '));
});
