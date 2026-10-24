// Settings: theme, profile, account, shortcuts.
import { el, icon, avatar, toast, confirmDialog } from '../ui.js';
import { state, toggleTheme, logout, applyTheme } from '../store.js';
import { openEditProfile } from '../components/edit-profile.js';

export function settingsView() {
  const column = el('div', { class: 'column' });
  const themeSwitch = el('button', { class: `switch${state.theme === 'dark' ? ' on' : ''}`, 'aria-label': 'Koyu tema' });
  const themeLabel = el('span', { text: state.theme === 'dark' ? 'Koyu tema açık' : 'Açık tema' });
  themeSwitch.addEventListener('click', () => {
    toggleTheme();
    const dark = state.theme === 'dark';
    themeSwitch.classList.toggle('on', dark);
    themeLabel.textContent = dark ? 'Koyu tema açık' : 'Açık tema';
  });

  const prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
  const pref = (key, label) => {
    const sw = el('button', { class: `switch${prefs[key] !== false ? ' on' : ''}`, 'aria-label': label });
    sw.addEventListener('click', () => {
      const next = !sw.classList.contains('on');
      sw.classList.toggle('on', next);
      const current = JSON.parse(localStorage.getItem('prefs') || '{}');
      current[key] = next;
      localStorage.setItem('prefs', JSON.stringify(current));
      toast(next ? `${label} açıldı` : `${label} kapatıldı`);
    });
    return sw;
  };

  const row = (title, desc, control) => el('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0',
      borderBottom: '1px solid var(--border)',
    },
  },
  el('div', { style: { flex: '1', minWidth: '0' } },
    el('div', { class: 'strong', text: title }),
    desc ? el('div', { class: 'muted small', text: desc }) : null),
  control);

  column.append(
    el('div', { class: 'page-title-row' }, el('h1', { text: 'Ayarlar' })),
    el('div', { class: 'card pad' },
      el('div', { class: 'user-row', style: { paddingTop: '0' } },
        avatar(state.me, 56),
        el('div', { class: 'who' }, el('b', { text: state.me.username }), el('span', { text: state.me.name })),
        el('button', { class: 'btn ghost sm', onclick: () => openEditProfile() }, 'Düzenle')),
      row('Koyu tema', 'Gece kullanımı için göz yormayan karanlık arayüz.', themeSwitch),
      row('Beğeni bildirimleri', 'Birisi gönderini beğendiğinde haber ver.', pref('likeNotif', 'Beğeni bildirimleri')),
      row('Yorum bildirimleri', 'Yeni yorumlarda bildirim göster.', pref('commentNotif', 'Yorum bildirimleri')),
      row('Mesaj bildirimleri', 'Yeni mesajlarda bildirim göster.', pref('dmNotif', 'Mesaj bildirimleri')),
      row('Hesaptan çıkış', 'Bu cihazdaki oturumun sonlanır.', el('button', {
        class: 'btn danger sm',
        onclick: async () => {
          if (await confirmDialog('Çıkış yapmak istediğine emin misin?', { title: 'Çıkış yap', confirmLabel: 'Çıkış yap' })) logout();
        },
      }, 'Çıkış yap'))),
    el('div', { class: 'card pad', style: { marginTop: '16px' } },
      el('h2', { style: { fontSize: '15px', marginBottom: '10px' } }, 'Klavye kısayolları'),
      el('div', { class: 'muted small', style: { lineHeight: '2' } },
        el('div', {}, el('b', { class: 'strong', text: 'n' }), ' — yeni gönderi'),
        el('div', {}, el('b', { class: 'strong', text: 'Esc' }), ' — açık pencereyi kapat'),
        el('div', {}, el('b', { class: 'strong', text: '← / →' }), ' — hikayelerde gezin'))),
    el('div', { class: 'card pad', style: { marginTop: '16px' } },
      el('h2', { style: { fontSize: '15px', marginBottom: '8px' } }, 'Uygulama hakkında'),
      el('p', { class: 'muted small', style: { lineHeight: '1.7' } },
        'Instaclone, hiçbir harici kütüphane kullanmadan Node.js yerleşik modülleri ve saf JavaScript ile yazılmış bir demo sosyal ağ uygulamasıdır. Veriler yerel SQLite dosyasında tutulur; görseller cihazında kalır.')));

  applyTheme();
  void icon;
  return { node: column };
}
