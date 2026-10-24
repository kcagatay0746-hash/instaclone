// Smoke test: renders every main route of the SPA against a stubbed API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, settle } from './ui-harness.mjs';

test('SPA açılır: kabuk, hikayeler ve akış render edilir', async () => {
  const { document } = await boot();
  assert.ok(document.querySelector('.sidebar'), 'kenar çubuğu yok');
  assert.ok(document.querySelector('.bottom-nav'), 'alt menü yok');
  assert.equal(document.querySelectorAll('.post').length, 1);
  assert.ok(document.querySelector('.stories'));
  assert.ok(document.querySelector('.rail'));
  assert.match(document.querySelector('.post').textContent, /Gün batımı/);
  assert.match(document.querySelector('.post').textContent, /Harika/);
  assert.ok(document.querySelector('.post .post-media img'));
});

test('rotalar çalışır: keşfet, profil, bildirimler, mesajlar, etiket, kaydedilenler', async () => {
  const { document, go } = await boot();
  await go('#/explore');
  assert.ok(document.querySelectorAll('.grid-item').length >= 1, 'keşfet grid boş');

  await go('#/u/ayse');
  assert.ok(document.querySelector('.profile-head'), 'profil başlığı yok');
  assert.match(document.querySelector('.profile-head').textContent, /ayse/);
  assert.match(document.querySelector('.profile-head').textContent, /takipçi/);

  await go('#/u/mehmet');
  assert.ok(document.querySelector('.profile-head .actions button'));

  await go('#/notifications');
  assert.ok(document.querySelectorAll('.notif').length >= 1);

  await go('#/messages');
  assert.ok(document.querySelector('.msgs'));
  assert.ok(document.querySelectorAll('.conv').length >= 1);

  await go('#/messages/mehmet');
  assert.ok(document.querySelector('.bubbles'));
  assert.equal(document.querySelectorAll('.bubble').length, 2);
  assert.ok(document.querySelector('.composer input'));

  await go('#/tag/istanbul');
  assert.match(document.querySelector('.tag-hero').textContent, /#istanbul/);

  await go('#/saved');
  assert.ok(document.querySelectorAll('.grid-item').length >= 1);

  await go('#/create');
  assert.ok(document.querySelector('.dropzone'));

  await go('#/settings');
  assert.match(document.body.textContent, /Ayarlar/);

  await go('#/feed');
  assert.equal(document.querySelectorAll('.post').length, 1);
});

test('post detayı açılır, yorumları ve aksiyonları gösterir', async () => {
  const { document, window } = await boot();
  assert.ok(document.querySelector('.post'));
  await window.__insta.openPost(11);
  await settle();
  assert.ok(document.querySelector('.pd'), 'detay görünümü yok');
  assert.match(document.querySelector('.pd').textContent, /Harika/);
  assert.ok(document.querySelector('.pd .side-foot .post-actions'));
  assert.ok(document.querySelector('.dialog .pd'), 'modal içinde detay yok');
});

test('gönderi beğenme ve yorum formu çalışır', async () => {
  const { document, window } = await boot();
  const card = document.querySelector('.post');
  const likeBtn = card.querySelector('.post-actions .icon-btn');
  likeBtn.click();
  await settle(4);
  assert.match(card.textContent, /13 beğeni/, 'beğeni sayısı güncellenmedi');

  const form = card.querySelector('form.post-comment-form');
  const input = form.querySelector('input');
  input.value = 'Yeni yorum';
  form.dispatchEvent(new window.Event('submit'));
  await settle(4);
  assert.match(card.textContent, /Yeni yorum/);
});
