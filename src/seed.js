'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { hashPassword } = require('./util');
const { avatarSvg, artSvg } = require('./seed-art');

const PEOPLE = [
  { username: 'ayse', name: 'Ayşe Yıldız', bio: 'Fotoğraf • Kahve • İstanbul 🌇' },
  { username: 'mehmet', name: 'Mehmet Kaya', bio: 'Dağlar, kahve ve kod ☕⛰️' },
  { username: 'zeynep', name: 'Zeynep Demir', bio: 'Tasarım & illüstrasyon ✏️' },
  { username: 'can', name: 'Can Aydın', bio: 'Sokak lezzetleri rehberi 🍜' },
  { username: 'elif', name: 'Elif Şahin', bio: 'Sabah koşuları ve gün doğumları 🌅' },
  { username: 'deniz', name: 'Deniz Arslan', bio: 'Müzik, plaklar ve deniz 🌊' },
];

const CAPTIONS = [
  'Gün batımı bu akşam fazla güzeldi. #istanbul #günbatımı #photography',
  'Yeni bir hafta, yeni hedefler ✨ #motivasyon',
  'Kahve molası olmadan olmuyor ☕ #coffee #sabah',
  'Bu manzaraya saatlerce bakabilirim 🌄 #doğa #dağ',
  'Yeni illüstrasyon serimin ilk parçası 🎨 #design #illustration',
  'Sokakta bulduğum en iyi lezzet 🍜 #food #streetfood',
  'Sabah koşusu tamamlandı 🏃‍♀️ #running #sağlıklıyaşam',
  'Vinilin sesi hiçbir şeye benzemiyor 🎧 #music #vinyl',
  'Işığın peşinde bir gün 📷 #photography #light',
  'Şehir her zaman bir hikâye anlatır 🌆 #city #sokak',
  'Hafta sonu planı: hiçbir şey yapmamak 😌 #weekend',
  'Yeni tarif denemesi: ev yapımı ramen 🍥 #food #recipe',
  'Renk paleti denemeleri 🎨 #color #art',
  'Deniz kenarında bir sabah 🌊 #sea #sabah',
];

const PLACES = ['İstanbul', 'İzmir', 'Kapadokya', 'Antalya', 'Ankara', 'Bodrum', 'Trabzon', ''];
const COMMENTS = ['Harika görünüyor! 🔥', 'Bu renkler mükemmel 😍', 'Nerede çektin?', 'Bayıldım!', 'Tam ilham kaynağı ✨', 'Süper 👏', 'Bir gün ben de deneyeceğim.'];
const GRAPH = {
  ayse: ['mehmet', 'zeynep', 'elif', 'deniz'],
  mehmet: ['ayse', 'can', 'deniz'],
  zeynep: ['ayse', 'elif'],
  can: ['ayse', 'mehmet', 'elif'],
  elif: ['ayse', 'deniz', 'zeynep'],
  deniz: ['mehmet', 'elif'],
};

module.exports = function seed({ db, uploadDir, now }) {
  fs.mkdirSync(uploadDir, { recursive: true });
  const writeSvg = (name, svg) => {
    fs.writeFileSync(path.join(uploadDir, name), svg);
    return name;
  };
  const password = hashPassword('demo1234');
  const ids = {};
  const addUser = db.prepare('INSERT INTO users (username, name, bio, avatar, password_hash, created_at) VALUES (?,?,?,?,?,?)');
  PEOPLE.forEach((p, i) => {
    const av = writeSvg(`seed-av-${p.username}.svg`, avatarSvg(p.name, p.username));
    ids[p.username] = Number(addUser.run(p.username, p.name, p.bio, av, password, now() - (60 + i) * 86400000).lastInsertRowid);
  });

  const addFollow = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)');
  for (const [a, list] of Object.entries(GRAPH)) {
    for (const b of list) addFollow.run(ids[a], ids[b], now() - 86400000);
  }

  const addPost = db.prepare('INSERT INTO posts (user_id, image, caption, location, created_at) VALUES (?,?,?,?,?)');
  const addTag = db.prepare('INSERT OR IGNORE INTO hashtags (post_id, tag) VALUES (?,?)');
  const addLike = db.prepare('INSERT OR IGNORE INTO likes (user_id, post_id, created_at) VALUES (?,?,?)');
  const addComment = db.prepare('INSERT INTO comments (post_id, user_id, text, created_at) VALUES (?,?,?,?)');

  const authors = PEOPLE.map((p) => p.username);
  const postIds = [];
  CAPTIONS.forEach((caption, i) => {
    const username = authors[i % authors.length];
    const img = writeSvg(`seed-post-${i + 1}.svg`, artSvg(`${username}-${i}`));
    const created = now() - (i * 7 + 2) * 3600000 - 60000;
    const pid = Number(addPost.run(ids[username], img, caption, PLACES[i % PLACES.length], created).lastInsertRowid);
    postIds.push({ pid, username });
    for (const m of caption.matchAll(/#([\p{L}\p{N}_]+)/gu)) addTag.run(pid, m[1].toLowerCase());
    authors.filter((a) => a !== username).forEach((a, j) => {
      if ((i + j) % 3 !== 0) addLike.run(ids[a], pid, created + 120000);
    });
    for (let k = 0; k < i % 3; k++) {
      const commenter = authors[(i + k + 1) % authors.length];
      addComment.run(pid, ids[commenter], COMMENTS[(i + k) % COMMENTS.length], created + (k + 1) * 600000);
    }
  });

  const addStory = db.prepare('INSERT INTO stories (user_id, image, created_at) VALUES (?,?,?)');
  ['zeynep', 'mehmet', 'elif', 'deniz'].forEach((u, i) => {
    const img = writeSvg(`seed-story-${u}.svg`, artSvg(`story-${u}`, false));
    addStory.run(ids[u], img, now() - (i + 1) * 3600000);
  });

  const addMsg = db.prepare('INSERT INTO messages (from_id, to_id, text, read, created_at) VALUES (?,?,?,?,?)');
  const convos = [
    ['ayse', 'mehmet', ['Selam! Yeni fotoğraflar harika 👏', 'Çok teşekkürler, beğendin mi gerçekten?', 'Kesinlikle, özellikle gün batımı olanı']],
    ['elif', 'ayse', ['Yarın sabah koşuya çıkıyor musun?', 'Evet! 7 gibi buluşalım mı?', 'Süper 🏃‍♀️']],
    ['can', 'deniz', ['Plak dükkânını buldum, hafta sonu gidelim mi?', 'Kesin gidelim 🙌']],
  ];
  convos.forEach(([a, b, texts], ci) => {
    texts.forEach((text, i) => {
      const from = i % 2 === 0 ? a : b;
      const to = i % 2 === 0 ? b : a;
      addMsg.run(ids[from], ids[to], text, i < texts.length - 1 ? 1 : 0, now() - (ci + 1) * 3600000 + i * 60000);
    });
  });

  const addNotif = db.prepare('INSERT INTO notifications (user_id, actor_id, type, post_id, text, read, created_at) VALUES (?,?,?,?,?,?,?)');
  addNotif.run(ids.ayse, ids.mehmet, 'like', postIds[0].pid, null, 0, now() - 3600000);
  addNotif.run(ids.ayse, ids.zeynep, 'comment', postIds[0].pid, COMMENTS[0], 0, now() - 3500000);
  addNotif.run(ids.ayse, ids.elif, 'follow', null, null, 0, now() - 3400000);
  addNotif.run(ids.mehmet, ids.ayse, 'like', postIds[1].pid, null, 1, now() - 7200000);

  console.log(`  Demo veriler oluşturuldu: ${PEOPLE.length} kullanıcı, ${CAPTIONS.length} gönderi`);
};
