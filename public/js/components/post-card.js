// Reusable feed post card: double-tap like, inline comments, save, delete.
import { API } from '../api.js';
import { el, icon, avatar, fmt, linkify, toast, bus, confirmDialog } from '../ui.js';
import { state } from '../store.js';
import { openMenu } from './menu.js';
import { openPost } from './post-detail.js';

export function postCard(post, { onDeleted } = {}) {
  const mediaImg = el('img', { src: post.image, alt: post.caption || 'Gönderi', loading: 'lazy', draggable: 'false' });
  const burst = el('div', { class: 'heart-burst' }, icon('heartFill', 96));
  const likeBtn = el('button', { class: 'icon-btn', 'aria-label': 'Beğen' });
  const saveBtn = el('button', { class: 'icon-btn', 'aria-label': 'Kaydet' });
  const likesEl = el('div', { class: 'post-likes' });
  const commentsEl = el('div', { class: 'post-comments' });
  const timeEl = el('div', { class: 'post-time' });
  const input = el('input', { placeholder: 'Yorum ekle…', 'aria-label': 'Yorum ekle', maxlength: '1000' });
  const sendBtn = el('button', { class: 'btn', type: 'submit' }, 'Paylaş');
  const node = el('article', { class: 'card post', 'data-post-id': post.id });

  const render = () => {
    likesEl.textContent = post.likes > 0 ? `${fmt.count(post.likes)} beğeni` : 'İlk beğenen sen ol';
    timeEl.textContent = fmt.time(post.created_at);
    likeBtn.replaceChildren(icon(post.liked ? 'heartFill' : 'heart', 24));
    likeBtn.classList.toggle('liked', post.liked);
    likeBtn.setAttribute('aria-pressed', String(post.liked));
    likeBtn.setAttribute('aria-label', post.liked ? 'Beğenmekten vazgeç' : 'Beğen');
    saveBtn.replaceChildren(icon(post.saved ? 'bookmarkFill' : 'bookmark', 24));
    saveBtn.classList.toggle('liked', post.saved);
    saveBtn.setAttribute('aria-label', post.saved ? 'Kaydı kaldır' : 'Kaydet');
    commentsEl.replaceChildren();
    for (const c of post.recent || []) {
      commentsEl.append(el('div', { class: 'c' }, el('b', { text: c.user.username }), linkify(c.text)));
    }
    if (post.comments > (post.recent || []).length) {
      commentsEl.append(el('div', {
        class: 'view-all',
        onclick: () => openPost(post.id),
      }, `Yorumların tümünü gör (${fmt.count(post.comments)})`));
    }
  };

  async function toggleLike(force) {
    const on = force === undefined ? !post.liked : force;
    if (on === post.liked) return;
    post.liked = on;
    post.likes += on ? 1 : -1;
    if (on) {
      burst.classList.remove('pop');
      void burst.offsetWidth;
      burst.classList.add('pop');
    }
    render();
    bus.emit('post:liked', post);
    try {
      const res = await API.like(post.id, on);
      post.likes = res.post.likes;
      post.liked = res.post.liked;
    } catch (err) {
      post.liked = !on;
      post.likes += on ? -1 : 1;
      toast(err.message, 'error');
    }
    render();
  }

  likeBtn.addEventListener('click', () => toggleLike());
  saveBtn.addEventListener('click', async () => {
    const on = !post.saved;
    post.saved = on;
    render();
    try {
      const res = await API.save(post.id, on);
      post.saved = res.post.saved;
      toast(on ? 'Kaydedildi' : 'Kaydedilenlerden çıkarıldı');
    } catch (err) {
      post.saved = !on;
      toast(err.message, 'error');
    }
    render();
  });

  let lastTap = 0;
  mediaImg.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastTap < 320) toggleLike(true);
    lastTap = now;
  });

  const form = el('form', {
    class: 'post-comment-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      sendBtn.disabled = true;
      try {
        const res = await API.comment(post.id, text);
        post.recent = [...(post.recent || []), res.comment].slice(-2);
        post.comments += 1;
        input.value = '';
        render();
        bus.emit('post:commented', post.id);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        sendBtn.disabled = false;
      }
    },
  }, input, sendBtn);

  const moreBtn = el('button', { class: 'icon-btn', 'aria-label': 'Seçenekler' }, icon('more', 22));
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openMenu(moreBtn, [
      {
        label: 'Bağlantıyı kopyala', iconName: 'link',
        onClick: () => { navigator.clipboard?.writeText(`${location.origin}/#/p/${post.id}`); toast('Bağlantı kopyalandı'); },
      },
      { label: 'Gönderiyi aç', iconName: 'image', onClick: () => openPost(post.id) },
      post.user.id === state.me.id ? '-' : null,
      post.user.id === state.me.id ? {
        label: 'Gönderiyi sil',
        iconName: 'trash',
        danger: true,
        onClick: async () => {
          if (!(await confirmDialog('Bu gönderi kalıcı olarak silinecek. Emin misin?'))) return;
          try {
            await API.deletePost(post.id);
            node.remove();
            toast('Gönderi silindi');
            if (onDeleted) onDeleted(post);
            bus.emit('post:deleted', post.id);
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      } : null,
    ]);
  });

  node.append(
    el('header', { class: 'post-head' },
      el('a', { href: `#/u/${post.user.username}` }, avatar(post.user, 38)),
      el('div', { class: 'who' },
        el('a', { href: `#/u/${post.user.username}` }, el('b', { text: post.user.username })),
        el('span', { text: post.location || post.user.name })),
      moreBtn),
    el('div', { class: 'post-media' }, mediaImg, burst),
    el('div', { class: 'post-actions' },
      likeBtn,
      el('button', { class: 'icon-btn', 'aria-label': 'Yorum yap', onclick: () => input.focus() }, icon('comment', 24)),
      el('button', {
        class: 'icon-btn',
        'aria-label': 'Paylaş',
        onclick: () => {
          navigator.clipboard?.writeText(`${location.origin}/#/p/${post.id}`);
          toast('Bağlantı kopyalandı');
        },
      }, icon('send', 24)),
      el('div', { class: 'grow' }),
      saveBtn),
    el('div', { class: 'post-body' },
      likesEl,
      post.caption ? el('div', { class: 'post-caption' }, el('b', { text: post.user.username }), linkify(post.caption)) : null,
      commentsEl,
      timeEl),
    form);

  render();
  return { node, update: render, post, moreBtn, form };
}
