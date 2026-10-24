// Profile page: header, stats, follow/message actions, posts & saved tabs.
import { API } from '../api.js';
import { el, icon, avatar, fmt, spinner, toast, modal, emptyState, bus, navigate } from '../ui.js';
import { state } from '../store.js';
import { postGrid } from '../components/grid.js';
import { followRow } from '../components/user-row.js';
import { openEditProfile } from '../components/edit-profile.js';
import { startCall } from '../components/call.js';

async function openList(title, username, kind) {
  const body = el('div', { class: 'follow-list' }, el('div', { class: 'load-more' }, spinner()));
  modal({ title, body, size: 'sm' });
  try {
    const res = kind === 'followers' ? await API.followers(username) : await API.following(username);
    body.replaceChildren(...(res.users.length
      ? res.users.map((u) => followRow(u, { subtitle: u.name }))
      : [el('p', { class: 'muted small', style: { padding: '16px 0' }, text: kind === 'followers' ? 'Henüz takipçi yok.' : 'Henüz takip edilen yok.' })]));
  } catch (err) {
    body.replaceChildren(el('p', { class: 'form-error', text: err.message }));
  }
}

export async function profileView(username) {
  const [{ user }, { posts }] = await Promise.all([API.user(username), API.userPosts(username)]);
  const isMe = user.is_me;
  const column = el('div', { class: 'column' });

  const stats = el('div', { class: 'stats' },
    el('div', { class: 'stat' }, el('b', { text: fmt.count(user.posts) }), ' gönderi'),
    el('button', {
      class: 'stat clickable', style: { background: 'none', border: '0', padding: '0', cursor: 'pointer', color: 'inherit' },
      onclick: () => openList('Takipçiler', user.username, 'followers'),
    }, el('b', { text: fmt.count(user.followers) }), ' takipçi'),
    el('button', {
      class: 'stat clickable', style: { background: 'none', border: '0', padding: '0', cursor: 'pointer', color: 'inherit' },
      onclick: () => openList('Takip edilenler', user.username, 'following'),
    }, el('b', { text: fmt.count(user.following) }), ' takip'));

  const actions = el('div', { class: 'actions' });
  const messageBtn = () => el('button', { class: 'btn ghost', onclick: () => navigate(`/messages/${user.username}`) }, icon('send', 18), 'Mesaj');

  if (isMe) {
    actions.append(
      el('button', { class: 'btn ghost', onclick: () => openEditProfile() }, 'Profili düzenle'),
      el('button', { class: 'btn ghost', onclick: () => navigate('/settings') }, icon('settings', 18), 'Ayarlar'));
  } else {
    let following = user.is_following;
    const followBtn = el('button', { class: following ? 'btn ghost' : 'btn primary' }, following ? 'Takip ediliyor' : 'Takip et');
    followBtn.addEventListener('click', async () => {
      followBtn.disabled = true;
      try {
        const res = await API.follow(user.username, !following);
        following = res.user.is_following;
        followBtn.textContent = following ? 'Takip ediliyor' : 'Takip et';
        followBtn.className = following ? 'btn ghost' : 'btn primary';
        stats.children[1].querySelector('b').textContent = fmt.count(res.user.followers);
        bus.emit('follow:changed', { username: user.username, following });
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        followBtn.disabled = false;
      }
    });
    actions.append(followBtn, messageBtn(),
      el('button', {
        class: 'icon-btn', 'aria-label': 'Sesli ara', title: 'Sesli ara',
        onclick: () => startCall(user.username, 'audio'),
      }, icon('phone', 22)),
      el('button', {
        class: 'icon-btn', 'aria-label': 'Görüntülü ara', title: 'Görüntülü ara',
        onclick: () => startCall(user.username, 'video'),
      }, icon('video', 22)));
  }

  const header = el('header', { class: 'profile-head' },
    el('div', { class: 'pic' },
      el('div', { class: 'wrap' }, avatar(user, 150)),
      isMe ? el('button', {
        class: 'btn text sm',
        onclick: () => import('./story-composer.js').then((m) => m.openStoryComposer(() => bus.emit('story:new'))),
      }, icon('plus', 15), 'Hikaye ekle') : null),
    el('div', { class: 'info' },
      el('div', { class: 'profile-top' }, el('h1', { text: user.username }), actions),
      stats,
      el('div', { class: 'profile-bio' },
        el('span', { class: 'name', text: user.name }),
        user.bio ? el('div', { text: user.bio }) : null,
        user.follows_me && !isMe ? el('div', { class: 'profile-meta', text: 'Seni takip ediyor' }) : null,
        el('div', { class: 'profile-meta', text: `Instaclone’a ${fmt.date(user.created_at)} tarihinde katıldı` }))));

  const gridWrap = el('div', {});
  const tabs = el('div', { class: 'tabs' });
  const tabPosts = el('button', { class: 'tab active' }, icon('grid', 16), 'Gönderiler');
  const tabReels = el('button', { class: 'tab' }, icon('play', 16), 'Reels');
  const tabSaved = el('button', { class: 'tab' }, icon('bookmark', 16), 'Kaydedilenler');
  tabs.append(tabPosts, tabReels);
  if (isMe) tabs.append(tabSaved);

  const renderTab = async (which) => {
    tabPosts.classList.toggle('active', which === 'posts');
    tabReels.classList.toggle('active', which === 'reels');
    tabSaved.classList.toggle('active', which === 'saved');
    gridWrap.replaceChildren(el('div', { class: 'load-more' }, spinner()));
    try {
      let list;
      if (which === 'posts') list = posts;
      else if (which === 'reels') list = posts.filter((p) => p.kind === 'video');
      else list = (await API.saved()).posts;
      const titles = {
        posts: ['Henüz gönderi yok', isMe ? 'İlk gönderini paylaşarak başla.' : `${user.username} henüz bir şey paylaşmadı.`],
        reels: ['Henüz video yok', isMe ? 'Video yükleyerek Reels akışında görün.' : `${user.username} henüz video paylaşmadı.`],
        saved: ['Henüz kaydedilen yok', 'Gönderileri kaydederek burada biriktir.'],
      };
      const [title, text] = titles[which];
      gridWrap.replaceChildren(list.length
        ? postGrid(list)
        : el('div', { class: 'card pad' }, emptyState(
          which === 'reels' ? 'play' : which === 'posts' ? 'camera' : 'bookmark',
          title,
          text,
          which !== 'saved' && isMe
            ? el('button', { class: 'btn primary', onclick: () => navigate('/create') }, 'Gönderi oluştur')
            : null)));
    } catch (err) {
      gridWrap.replaceChildren(el('p', { class: 'form-error', text: err.message }));
    }
  };
  tabPosts.addEventListener('click', () => renderTab('posts'));
  tabReels.addEventListener('click', () => renderTab('reels'));
  tabSaved.addEventListener('click', () => renderTab('saved'));

  const card = el('div', { class: 'card', style: { overflow: 'hidden' } },
    el('div', { style: { padding: '8px 20px 0' } }, header),
    el('div', { style: { padding: '0 20px' } }, tabs),
    el('div', { style: { padding: '10px 3px 3px' } }, gridWrap));
  column.append(card);
  await renderTab('posts');

  const offFollow = bus.on('follow:changed', ({ username: u, following }) => {
    if (u === user.username && !isMe) {
      user.followers += following ? 1 : -1;
      stats.children[1].querySelector('b').textContent = fmt.count(user.followers);
    }
  });
  const offProfile = bus.on('profile:updated', () => { if (isMe) navigate(`/u/${state.me.username}`); });
  const offDeleted = bus.on('post:deleted', () => renderTab('posts'));

  return {
    node: column,
    wide: true,
    cleanup: () => { offFollow(); offProfile(); offDeleted(); },
  };
}
