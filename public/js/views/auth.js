// Login / register screen with a gradient hero panel.
import { API } from '../api.js';
import { el, icon, toast } from '../ui.js';
import { state } from '../store.js';
import { connectEvents } from '../store.js';

export function authView(onAuthed) {
  let mode = 'login';
  const error = el('div', { class: 'form-error' });

  const username = el('input', { class: 'input', placeholder: 'kullanıcı adı', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
  const name = el('input', { class: 'input', placeholder: 'Ad Soyad', autocomplete: 'name', style: { display: 'none' } });
  const password = el('input', { class: 'input', type: 'password', placeholder: 'şifre', autocomplete: 'current-password' });
  const submit = el('button', { class: 'btn gradient lg block', type: 'submit' }, 'Giriş yap');

  const nameField = el('div', { class: 'field', style: { display: 'none' } }, el('label', { text: 'Ad Soyad' }), name);
  const title = el('h2', { text: 'Tekrar hoş geldin' });
  const sub = el('p', { class: 'sub', text: 'Arkadaşlarının paylaştıklarını görmek için giriş yap.' });
  const switchText = el('span');

  async function doSubmit(e) {
    e.preventDefault();
    error.textContent = '';
    submit.disabled = true;
    const original = submit.textContent;
    submit.textContent = 'Lütfen bekle…';
    try {
      const res = mode === 'login'
        ? await API.login(username.value.trim(), password.value)
        : await API.register(username.value.trim(), name.value.trim(), password.value);
      state.me = res.user;
      connectEvents();
      toast(mode === 'login' ? `Hoş geldin, ${res.user.username}!` : 'Hesabın oluşturuldu 🎉');
      onAuthed();
    } catch (err) {
      error.textContent = err.message;
      password.select();
    } finally {
      submit.disabled = false;
      submit.textContent = original;
    }
  }

  function setMode(next) {
    mode = next;
    const login = mode === 'login';
    title.textContent = login ? 'Tekrar hoş geldin' : 'Yeni hesap oluştur';
    sub.textContent = login ? 'Arkadaşlarının paylaştıklarını görmek için giriş yap.' : 'Bir kullanıcı adı seç ve paylaşmaya başla.';
    submit.textContent = login ? 'Giriş yap' : 'Kayıt ol';
    nameField.style.display = login ? 'none' : '';
    password.setAttribute('autocomplete', login ? 'current-password' : 'new-password');
    switchText.textContent = login ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? ';
    switchBtn.textContent = login ? 'Kayıt ol' : 'Giriş yap';
    error.textContent = '';
  }

  const switchBtn = el('button', { type: 'button', onclick: () => setMode(mode === 'login' ? 'register' : 'login') }, 'Kayıt ol');

  const form = el('form', { onsubmit: doSubmit, novalidate: true },
    el('div', { class: 'field' }, el('label', { text: 'Kullanıcı adı' }), username),
    nameField,
    el('div', { class: 'field' }, el('label', { text: 'Şifre' }), password),
    error,
    submit);

  const box = el('div', { class: 'auth-box' },
    el('div', { class: 'brand' },
      el('img', { src: '/img/logo.svg', alt: '', style: { width: '34px', height: '34px', borderRadius: '10px' } }),
      el('div', { class: 'wordmark', style: { fontSize: '30px' } }, 'Insta', el('span', {}, 'clone'))),
    title,
    sub,
    form,
    el('div', { class: 'auth-switch' }, switchText, switchBtn),
    el('div', { class: 'demo' },
      el('div', {}, 'Hazır demo hesabıyla hemen bak: ', el('code', { text: 'ayse' }), ' / ', el('code', { text: 'demo1234' })),
      el('div', {}, 'Diğer hesaplar: mehmet, zeynep, can, elif, deniz')));

  const hero = el('div', { class: 'auth-art' },
    el('div', { class: 'glow g-a' }), el('div', { class: 'glow g-b' }),
    el('div', { class: 'inner' },
      el('img', { class: 'logo', src: '/img/logo.svg', alt: '' }),
      el('h1', {}, 'Anlarını paylaş,', el('br'), 'dünyayı keşfet.'),
      el('p', { text: 'Fotoğraf paylaş, hikaye ekle, arkadaşlarınla sohbet et. Hepsi tek yerde.' }),
      el('ul', {},
        el('li', {}, el('span', { class: 'dot' }, icon('camera', 15)), 'Filtreli gönderiler ve hikayeler'),
        el('li', {}, el('span', { class: 'dot' }, icon('heart', 15)), 'Beğeni, yorum ve gerçek zamanlı bildirimler'),
        el('li', {}, el('span', { class: 'dot' }, icon('message', 15)), 'Birebir mesajlaşma'),
        el('li', {}, el('span', { class: 'dot' }, icon('compass', 15)), 'Keşfet akışı ve hashtag sayfaları'))));

  setTimeout(() => username.focus(), 80);
  return el('div', { class: 'auth' }, hero, el('div', { class: 'auth-panel' }, box));
}
