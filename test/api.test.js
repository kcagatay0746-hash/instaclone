'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 4399 + Math.floor(Math.random() * 200);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'instaclone-test-'));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

let child;
let cookie = '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(pathname, { method = 'GET', body, raw = false, ck = cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (ck) h.Cookie = ck;
  const res = await fetch(BASE + pathname, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  if (raw) return res;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json, text, headers: res.headers };
}

async function login(username, password = 'demo1234') {
  const res = await req('/api/login', { method: 'POST', body: { username, password } });
  assert.equal(res.status, 200, `login failed: ${res.text}`);
  return res.json.user;
}

before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), DATA_DIR, HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`${BASE}/api/me`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(120);
  }
  throw new Error(`Sunucu başlamadı: ${err}`);
});

after(() => {
  if (child) child.kill('SIGTERM');
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

test('demo hesabıyla giriş yapılır, hatalı şifre 401 döner', async () => {
  const bad = await req('/api/login', { method: 'POST', body: { username: 'ayse', password: 'yanlis' } });
  assert.equal(bad.status, 401);
  const user = await login('ayse');
  assert.equal(user.username, 'ayse');
  const me = await req('/api/me');
  assert.equal(me.json.user.username, 'ayse');
});

test('oturumsuz istekler 401, JSON olmayan mutasyonlar 415', async () => {
  const anon = await req('/api/feed', { ck: '' });
  assert.equal(anon.status, 401);
  const noJson = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'username=ayse',
  });
  assert.equal(noJson.status, 415);
  const crossOrigin = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' },
    body: JSON.stringify({ username: 'ayse', password: 'demo1234' }),
  });
  assert.equal(crossOrigin.status, 403);
});

test('akış gönderileri son yorumlarla birlikte döner', async () => {
  await login('ayse');
  const feed = await req('/api/feed');
  assert.equal(feed.status, 200);
  assert.ok(feed.json.posts.length > 0);
  const post = feed.json.posts[0];
  assert.ok(post.user.username);
  assert.ok(Array.isArray(post.recent));
  assert.equal(typeof post.likes, 'number');
});

test('gönderi oluşturma, beğeni, yorum, kaydetme ve silme', async () => {
  await login('can');
  const created = await req('/api/posts', { method: 'POST', body: { image: PNG, caption: 'Test gönderisi #deneme @ayse', location: 'Test' } });
  assert.equal(created.status, 201);
  const id = created.json.post.id;

  const tagged = await req('/api/tags/deneme');
  assert.ok(tagged.json.posts.some((p) => p.id === id));

  const liked = await req(`/api/posts/${id}/like`, { method: 'POST', body: {} });
  assert.equal(liked.json.post.liked, true);
  assert.equal(liked.json.post.likes, 1);

  const unliked = await req(`/api/posts/${id}/like`, { method: 'DELETE', body: {} });
  assert.equal(unliked.json.post.liked, false);

  const comment = await req(`/api/posts/${id}/comments`, { method: 'POST', body: { text: 'İlk yorum' } });
  assert.equal(comment.status, 201);
  const comments = await req(`/api/posts/${id}/comments`);
  assert.equal(comments.json.comments.length, 1);
  assert.equal(comments.json.comments[0].mine, true);

  const saved = await req(`/api/posts/${id}/save`, { method: 'POST', body: {} });
  assert.equal(saved.json.post.saved, true);
  const savedList = await req('/api/saved');
  assert.ok(savedList.json.posts.some((p) => p.id === id));

  const del = await req(`/api/posts/${id}`, { method: 'DELETE', body: {} });
  assert.equal(del.status, 200);
  const gone = await req(`/api/posts/${id}`);
  assert.equal(gone.status, 404);
  const commentDel = await req(`/api/comments/${comment.json.comment.id}`, { method: 'DELETE', body: {} });
  assert.equal(commentDel.status, 404);
});

test('başkasının gönderisi silinemez, kendini takip edemezsin', async () => {
  await login('ayse');
  const feed = await req('/api/feed');
  const other = feed.json.posts.find((p) => p.user.username !== 'ayse');
  const del = await req(`/api/posts/${other.id}`, { method: 'DELETE', body: {} });
  assert.equal(del.status, 403);
  const self = await req('/api/users/ayse/follow', { method: 'POST', body: {} });
  assert.equal(self.status, 400);
});

test('takip et / bırak akışı ve bildirimler', async () => {
  await login('deniz');
  const f = await req('/api/users/can/follow', { method: 'POST', body: {} });
  assert.equal(f.json.user.is_following, true);

  await login('can');
  const notif = await req('/api/notifications');
  assert.ok(notif.json.notifications.some((n) => n.type === 'follow' && n.user.username === 'deniz'));
  const read = await req('/api/notifications/read', { method: 'POST', body: {} });
  assert.equal(read.status, 200);

  await login('deniz');
  const u = await req('/api/users/can/follow', { method: 'DELETE', body: {} });
  assert.equal(u.json.user.is_following, false);
  const prof = await req('/api/users/can');
  assert.equal(prof.json.user.username, 'can');
  assert.equal(prof.json.user.is_me, false);
  const followers = await req('/api/users/ayse/followers');
  assert.equal(followers.status, 200);
});

test('hikaye eklenir, listelenir, görüntülenir ve silinir', async () => {
  await login('elif');
  const add = await req('/api/stories', { method: 'POST', body: { image: PNG } });
  assert.equal(add.status, 201);
  const stories = await req('/api/stories');
  const mine = stories.json.groups.find((g) => g.user.username === 'elif');
  assert.ok(mine && mine.stories.length >= 1);
  const sid = mine.stories[mine.stories.length - 1].id;
  const view = await req(`/api/stories/${sid}/view`, { method: 'POST', body: {} });
  assert.equal(view.status, 200);
  const del = await req(`/api/stories/${sid}`, { method: 'DELETE', body: {} });
  assert.equal(del.status, 200);
});

test('mesaj gönderme, konuşma listesi ve okundu işaretleme', async () => {
  await login('mehmet');
  const sent = await req('/api/messages/zeynep', { method: 'POST', body: { text: 'Selam Zeynep!' } });
  assert.equal(sent.status, 201);
  const convs = await req('/api/messages');
  assert.ok(convs.json.conversations.some((c) => c.user.username === 'zeynep'));
  const thread = await req('/api/messages/zeynep');
  assert.ok(thread.json.messages.some((m) => m.text === 'Selam Zeynep!' && m.mine));
  const self = await req('/api/messages/mehmet', { method: 'POST', body: { text: 'x' } });
  assert.equal(self.status, 400);
});

test('arama, keşfet ve öneriler çalışır', async () => {
  await login('ayse');
  const s = await req('/api/search?q=zey');
  assert.ok(s.json.users.some((u) => u.username === 'zeynep'));
  const explore = await req('/api/explore');
  assert.equal(explore.status, 200);
  assert.ok(explore.json.posts.every((p) => p.user.username !== 'ayse'));
  const sug = await req('/api/suggestions');
  assert.equal(sug.status, 200);
});

test('kayıt olma, doğrulama ve çıkış', async () => {
  const badUser = await req('/api/register', { method: 'POST', body: { username: 'a', password: '123456' } });
  assert.equal(badUser.status, 400);
  const shortPw = await req('/api/register', { method: 'POST', body: { username: 'yenikisi', password: '123' } });
  assert.equal(shortPw.status, 400);
  const ok = await req('/api/register', { method: 'POST', body: { username: 'yenikisi', password: 'gizli123', name: 'Yeni Kişi' } });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.user.username, 'yenikisi');
  const dup = await req('/api/register', { method: 'POST', body: { username: 'yenikisi', password: 'gizli123' } });
  assert.equal(dup.status, 409);
  const out = await req('/api/logout', { method: 'POST', body: {} });
  assert.equal(out.status, 200);
  const me = await req('/api/me');
  assert.equal(me.json.user, null);
});
const MP4 = 'data:video/mp4;base64,' + Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypmp42', 'latin1'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('mp42isom', 'latin1'),
  Buffer.from('fake-video-payload-for-range-tests', 'latin1'),
]).toString('base64');

async function sessionFor(username, password = 'demo1234') {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200);
  return res.headers.get('set-cookie').split(';')[0];
}

test('video gönderisi, reels akışı, görüntüleme sayacı ve Range desteği', async () => {
  await login('zeynep');
  const created = await req('/api/posts', {
    method: 'POST',
    body: { video: MP4, poster: PNG, caption: 'İlk reel #video', location: 'Stüdyo' },
  });
  assert.equal(created.status, 201);
  const post = created.json.post;
  assert.equal(post.kind, 'video');
  assert.ok(post.video && post.video.endsWith('.mp4'), `video url: ${post.video}`);
  assert.ok(post.image && post.image.endsWith('.png'));

  const reels = await req('/api/reels');
  assert.equal(reels.status, 200);
  assert.ok(reels.json.posts.some((p) => p.id === post.id));

  const first = await req(`/api/posts/${post.id}/view`, { method: 'POST', body: {} });
  assert.equal(first.json.views, 1);
  assert.equal(first.json.counted, true);
  const second = await req(`/api/posts/${post.id}/view`, { method: 'POST', body: {} });
  assert.equal(second.json.views, 1);
  assert.equal(second.json.counted, false);

  const ranged = await fetch(BASE + post.video, { headers: { Range: 'bytes=0-9' } });
  assert.equal(ranged.status, 206);
  assert.match(ranged.headers.get('content-range'), /^bytes 0-9\/\d+$/);
  const body = Buffer.from(await ranged.arrayBuffer());
  assert.equal(body.length, 10);
  assert.equal(body.subarray(4, 8).toString('latin1'), 'ftyp');

  const del = await req(`/api/posts/${post.id}`, { method: 'DELETE', body: {} });
  assert.equal(del.status, 200);
});

test('geçersiz video ve poster yüklemeleri reddedilir', async () => {
  await login('zeynep');
  const badType = await req('/api/posts', { method: 'POST', body: { video: 'data:video/mp4;base64,aGFsbw==', poster: PNG } });
  assert.equal(badType.status, 400);
  const noMedia = await req('/api/posts', { method: 'POST', body: { caption: 'medyasız' } });
  assert.equal(noMedia.status, 400);
});

test('arama sinyalleşmesi: teklif, yanıt, meşgul ve bitirme', async () => {
  const ayseCk = await sessionFor('ayse');
  const mehmetCk = await sessionFor('mehmet');
  const offer = JSON.stringify({ type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\n' });

  const started = await req('/api/calls', { method: 'POST', ck: ayseCk, body: { username: 'mehmet', kind: 'video', offer } });
  assert.equal(started.status, 201);
  const callId = started.json.call.id;
  assert.equal(started.json.call.kind, 'video');

  const busy = await req('/api/calls', { method: 'POST', ck: mehmetCk, body: { username: 'can', kind: 'audio', offer } });
  assert.equal(busy.status, 409);

  const wrongAnswer = await req(`/api/calls/${callId}/answer`, { method: 'POST', ck: ayseCk, body: { answer: offer } });
  assert.equal(wrongAnswer.status, 403);

  const answered = await req(`/api/calls/${callId}/answer`, { method: 'POST', ck: mehmetCk, body: { answer: offer.replace('offer', 'answer') } });
  assert.equal(answered.status, 200);
  assert.equal(answered.json.call.status, 'active');

  const ended = await req(`/api/calls/${callId}/end`, { method: 'POST', ck: ayseCk, body: {} });
  assert.equal(ended.status, 200);
  assert.equal(ended.json.call.status, 'ended');

  const history = await req('/api/calls/history', { ck: ayseCk });
  assert.ok(history.json.calls.some((c) => c.id === callId && c.direction === 'outgoing'));
  assert.ok(history.json.calls.some((c) => c.id === callId));

  // the call is recorded in the DM thread for both sides
  const thread = await req('/api/messages/mehmet', { ck: ayseCk });
  const callMsg = thread.json.messages.find((m) => m.kind === 'call' && m.call_id === callId);
  assert.ok(callMsg, 'DM geçmişinde arama kaydı yok');
  assert.match(callMsg.text, /Görüntülü arama/);
});

test('arama: kendini arayamazsın, cevaplanmayan arama cevapsız kalır', async () => {
  const canCk = await sessionFor('can');
  const elifCk = await sessionFor('elif');
  const offer = JSON.stringify({ type: 'offer', sdp: 'v=0\r\ns=-\r\n' });

  const self = await req('/api/calls', { method: 'POST', ck: canCk, body: { username: 'can', kind: 'audio', offer } });
  assert.equal(self.status, 400);

  const bad = await req('/api/calls', { method: 'POST', ck: canCk, body: { username: 'elif', kind: 'audio', offer: 'x' } });
  assert.equal(bad.status, 400);

  const started = await req('/api/calls', { method: 'POST', ck: canCk, body: { username: 'elif', kind: 'audio', offer } });
  assert.equal(started.status, 201);
  const declined = await req(`/api/calls/${started.json.call.id}/decline`, { method: 'POST', ck: elifCk, body: {} });
  assert.equal(declined.status, 200);
  assert.equal(declined.json.call.status, 'declined');
  assert.match(declined.json.summary, /reddedildi/);
});



test('statik dosyalar, SPA fallback ve yol geçişi koruması', async () => {
  const home = await req('/', { raw: true });
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type'), /text\/html/);
  assert.match(home.headers.get('content-security-policy') || '', /default-src 'self'/);
  const spa = await req('/u/ayse', { raw: true });
  assert.equal(spa.status, 200);
  const traversal = await req('/uploads/..%2f..%2fdata%2fapp.db', { raw: true });
  assert.notEqual(traversal.status, 200);
  const missing = await req('/uploads/yok.png', { raw: true });
  assert.equal(missing.status, 404);
});

