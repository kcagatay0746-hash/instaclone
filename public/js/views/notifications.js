// Notifications list with follow-back buttons and read tracking.
import { API } from '../api.js';
import { el, icon, avatar, fmt, spinner, toast, emptyState, bus, navigate } from '../ui.js';
import { state, reloadCounts } from '../store.js';
import { openPost } from '../components/post-detail.js';

const TEXT = {
  like: 'gönderini beğendi',
  comment: 'gönderine yorum yaptı',
  follow: 'seni takip etmeye başladı',
  mention: 'bir gönderide senden bahsetti',
};
const ICON = { like: 'heartFill', comment: 'comment', follow: 'user', mention: 'tag' };

function followBackBtn(username) {
  const btn = el('button', { class: 'btn primary sm' }, 'Takip et');
  let following = false;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    btn.disabled = true;
    try {
      await API.follow(username, !following);
      following = !following;
      btn.textContent = following ? 'Takiptesin' : 'Takip et';
      btn.className = following ? 'btn ghost sm' : 'btn primary sm';
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
  return btn;
}

export async function notificationsView() {
  const column = el('div', { class: 'column' });
  const list = el('div', { class: 'card', style: { padding: '8px' } });
  column.append(
    el('div', { class: 'page-title-row' },
      el('h1', { text: 'Bildirimler' }),
      state.unreadNotifications ? el('span', { class: 'count-pill', text: `${state.unreadNotifications} yeni` }) : null),
    list);
  list.append(el('div', { class: 'load-more' }, spinner()));

  async function load() {
    try {
      const { notifications } = await API.notifications();
      list.replaceChildren();
      if (!notifications.length) {
        list.append(emptyState('bell', 'Bildirim yok', 'Beğeniler, yorumlar ve yeni takipçiler burada görünecek.'));
        return;
      }
      for (const n of notifications) {
        const row = el('div', {
          class: `notif${n.read ? '' : ' unread'}`,
          onclick: () => {
            if (n.post_id) openPost(n.post_id);
            else navigate(`/u/${n.user.username}`);
          },
        },
        el('div', { class: 'notif-ic' },
          avatar(n.user, 46),
          el('span', { class: `badge-ic ${n.type}` }, icon(ICON[n.type] || 'bell', 11))),
        el('div', { class: 'txt' },
          el('b', { text: n.user.username }),
          ' ',
          TEXT[n.type] || 'bir etkileşimde bulundu',
          n.type === 'comment' && n.text ? el('span', { class: 'muted', text: `: “${n.text}”` }) : null,
          el('span', { class: 'when', text: fmt.time(n.created_at) })),
        n.post_image ? el('img', { class: 'thumb', src: n.post_image, alt: '' }) : null,
        n.type === 'follow' ? followBackBtn(n.user.username) : null);
        list.append(row);
      }
      await API.readNotifications();
      state.unreadNotifications = 0;
      await reloadCounts();
      bus.emit('counts', state);
    } catch (err) {
      list.replaceChildren(el('div', { class: 'empty' },
        el('h3', { text: 'Bildirimler yüklenemedi' }),
        el('p', { text: err.message }),
        el('button', { class: 'btn ghost', onclick: load }, 'Tekrar dene')));
    }
  }

  await load();
  const off = bus.on('notifications:refresh', load);
  return { node: column, cleanup: off };
}
