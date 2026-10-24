'use strict';
// Desktop launcher: starts the built-in server and opens it in its own app window.
// Works with a locally installed Chrome/Chromium/Edge/Brave; falls back to the
// default browser if none is found. No packages are installed.
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');

const PORT = Number(process.env.PORT || 3000);
const URL = `http://localhost:${PORT}/#/feed`;
const ROOT = path.join(__dirname, '..');

function ping(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/me', timeout: 800 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function which(bin) {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const out = spawnSync(finder, [bin], { encoding: 'utf8' });
  if (out.status !== 0) return null;
  return out.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || null;
}

function findBrowser() {
  const candidates = process.platform === 'darwin'
    ? [
      ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'Google Chrome'],
      ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Microsoft Edge'],
      ['/Applications/Chromium.app/Contents/MacOS/Chromium', 'Chromium'],
      ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', 'Brave Browser'],
    ]
    : process.platform === 'win32'
      ? [
        [`${process.env['PROGRAMFILES'] || 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`, 'Google Chrome'],
        [`${process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`, 'Google Chrome'],
        [`${process.env['PROGRAMFILES'] || 'C:\\Program Files'}\\Microsoft\\Edge\\Application\\msedge.exe`, 'Microsoft Edge'],
      ]
      : [
        ['google-chrome', 'Google Chrome'],
        ['google-chrome-stable', 'Google Chrome'],
        ['chromium', 'Chromium'],
        ['chromium-browser', 'Chromium'],
        ['microsoft-edge', 'Microsoft Edge'],
        ['brave-browser', 'Brave'],
      ];
  for (const [cmd, label] of candidates) {
    const resolved = cmd.includes('/') || cmd.includes('\\') ? (require('node:fs').existsSync(cmd) ? cmd : null) : which(cmd);
    if (resolved) return { cmd: resolved, label };
  }
  return null;
}

function openBrowser() {
  const browser = findBrowser();
  if (browser) {
    const args = [
      `--app=${URL}`,
      '--window-size=1280,880',
      '--user-data-dir=' + path.join(os.homedir(), '.instaclone-app'),
      '--no-first-run',
      '--no-default-browser-check',
    ];
    console.log(`  ${browser.label} uygulama penceresi açılıyor…`);
    const child = spawn(browser.cmd, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => openDefault());
    child.unref();
    return;
  }
  openDefault();
}

function openDefault() {
  console.log(`  Uygun bir Chrome/Edge bulunamadı, varsayılan tarayıcı açılıyor…`);
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', URL] : [URL];
  const child = spawn(opener, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => console.log(`  Tarayıcı otomatik açılamadı. Şu adresi elle aç: ${URL}`));
  child.unref();
}

(async () => {
  let server = null;
  if (await ping(PORT)) {
    console.log(`  Sunucu zaten çalışıyor (port ${PORT}).`);
  } else {
    console.log(`  Sunucu başlatılıyor: http://localhost:${PORT}`);
    server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'inherit',
    });
    for (let i = 0; i < 80; i++) {
      if (await ping(PORT)) break;
      await sleep(120);
    }
  }
  openBrowser();
  console.log('\n  Uygulamayı kapatmak için bu terminalde Ctrl+C yapabilirsin.\n');
  const stop = () => {
    if (server) server.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  if (server) server.on('exit', (code) => process.exit(code ?? 0));
})();
