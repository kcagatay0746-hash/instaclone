// Full post view: used both as a modal (feed grids) and as a standalone page.
import { API } from '../api.js';
import { el, icon, avatar, fmt, linkify, toast, modal, spinner, confirmDialog, navigate, bus } from '../ui.js';
import { state } from '../store.js';
import { openMenu } from './menu.js';

function commentRow(c, post, onChange) {
  const canDelete = c.mine || post.user.id === state.me.id;
  return el('div', { class: 'comment', 'data-cid': c.id },
    el('a', { href: `#/u/${c.user.username}` }, avatar(c.user, 32)),
    el('div', { class: 'body' },
      el('a', { href: `#/u/${c.user.username}`, class: 'strong' }, c.user.username),
      ' ',
      linkify(c.text),
      el('div', { class: 'meta' },
        el('span', { text: fmt.time(c.created_at) }),
        canDelete ? el('button', {
          text: 'Sil',
          onclick: async () => {
            if (!(await confirmDialog('Yorumu silmek istediğine emin misin?', { title: 'Yorumu sil' }))) return;
            try {
              await API.deleteComment(c.id);
              post.comments = Math.max(0, post.comments - 1);
              onChange();
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        }) : null)));
}

export function postDetailNode(post, comments, { onClose, onDeleted } = {}) {
  const img = el('img', { src: post.image, alt: post.caption || 'Gönderi', draggable: 'false' });
  const commentsWrap = el('div', { class: 'side-comments' });
  const likeBtn = el('button', { class: 'icon-btn', 'aria-label': 'Beğen' });
  const saveBtn = el('button', { class: 'icon-btn', 'aria-label': 'Kaydet' });
  const likesEl = el('div', { class: 'post-likes' });
  const timeEl = el('div', { class: 'post-time', text: fmt.date(post.created_at) });
  const input = el('input', { placeholder: 'Yorum ekle…', maxlength: '1000' });

  const renderComments = () => {
    commentsWrap.replaceChildren();
    if (post.caption) {
      commentsWrap.append(el('div', { class: 'caption-block' },
        el('a', { href: `#/u/${post.user.username}` }, avatar(post.user, 32)),
        el('div', { class: 'body' },
          el('a', { href: `#/u/${post.user.username}`, class: 'strong' }, post.user.username),
          ' ',
          linkify(post.caption),
          post.location ? el('div', { class: 'muted small', text: `📍 ${post.location}` }) : null)));
    }
    if (!comments.length) {
      commentsWrap.append(el('div', { class: 'empty' },
        el('div', { class: 'empty-ic' }, icon('comment', 30)),
        el('h3', { text: 'Henüz yorum yok' }),
        el('p', { text: 'İlk yorumu sen yap.' })));
    }
    for (const c of comments) commentsWrap.append(commentRow(c, post, renderComments));
  };

  const renderActions = () => {
    likeBtn.replaceChildren(icon(post.liked ? 'heartFill' : 'heart', 24));
    likeBtn.classList.toggle('liked', post.liked);
    saveBtn.replaceChildren(icon(post.saved ? 'bookmarkFill' : 'bookmark', 24));
    saveBtn.classList.toggle('liked', post.saved);
    likesEl.textContent = post.likes > 0 ? `${fmt.count(post.likes)} beğeni` : 'İlk beğenen sen ol';
  };

  likeBtn.addEventListener('click', async () => {
    const on = !post.liked;
    post.liked = on;
    post.likes += on ? 1 : -1;
    renderActions();
    try {
      const res = await API.like(post.id, on);
      post.likes = res.post.likes;
      post.liked = res.post.liked;
    } catch (err) {
      post.liked = !on;
      post.likes += on ? -1 : 1;
      toast(err.message, 'error');
    }
    renderActions();
  });

  saveBtn.addEventListener('click', async () => {
    const on = !post.saved;
    post.saved = on;
    renderActions();
    try {
      await API.save(post.id, on);
      toast(on ? 'Kaydedildi' : 'Kaydedilenlerden çıkarıldı');
    } catch (err) {
      post.saved = !on;
      toast(err.message, 'error');
    }
    renderActions();
  });

  const form = el('form', {
    class: 'post-comment-form',
    onsubmit: async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      try {
        const res = await API.comment(post.id, text);
        comments.push(res.comment);
        post.comments += 1;
        input.value = '';
        renderComments();
        commentsWrap.scrollTop = commentsWrap.scrollHeight;
      } catch (err) {
        toast(err.message, 'error');
      }
    },
  }, input, el('button', { class: 'btn', type: 'submit' }, 'Paylaş'));

  const moreBtn = el('button', { class: 'icon-btn', 'aria-label': 'Seçenekler' }, icon('more', 22));
  moreBtn.addEventListener('click', () => {
    openMenu(moreBtn, [
      {
        label: 'Bağlantıyı kopyala', iconName: 'link',
        onClick: () => { navigator.clipboard?.writeText(`${location.origin}/#/p/${post.id}`); toast('Bağlantı kopyalandı'); },
      },
      post.user.id === state.me.id ? '-' : null,
      post.user.id === state.me.id ? {
        label: 'Gönderiyi sil', iconName: 'trash', danger: true,
        onClick: async () => {
          if (!(await confirmDialog('Bu gönderi kalıcı olarak silinecek. Emin misin?'))) return;
          try {
            await API.deletePost(post.id);
            toast('Gönderi silindi');
            if (onDeleted) onDeleted(post);
            bus.emit('post:deleted', post.id);
            if (onClose) onClose();
            else navigate('/feed');
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      } : null,
    ]);
  });

  const node = el('div', { class: 'pd' },
    el('div', { class: 'media' }, img),
    el('div', { class: 'side' },
      el('header', { class: 'side-head' },
        el('a', { href: `#/u/${post.user.username}` }, avatar(post.user, 34)),
        el('div', { class: 'who' },
          el('a', { href: `#/u/${post.user.username}` }, el('b', { text: post.user.username })),
          el('span', { text: post.location || post.user.name })),
        moreBtn),
      commentsWrap,
      el('div', { class: 'side-foot' },
        el('div', { class: 'post-actions' },
          likeBtn,
          el('button', { class: 'icon-btn', 'aria-label': 'Yorum yap', onclick: () => input.focus() }, icon('comment', 24)),
          el('div', { class: 'grow' }),
          saveBtn),
        likesEl,
        timeEl,
        form)));

  renderComments();
  renderActions();
  return node;
}

export async function openPost(id) {
  const body = el('div', { class: 'load-more' }, spinner());
  const m = modal({ size: 'xl', body, headerExtra: el('span', { class: 'strong', text: 'Gönderi' }) });
  try {
    const [{ post }, { comments }] = await Promise.all([API.post(id), API.comments(id)]);
    m.body.replaceChildren(postDetailNode(post, comments, { onClose: () => m.close() }));
  } catch (err) {
    m.body.replaceChildren(el('div', { class: 'empty' },
      el('h3', { text: 'Gönderi yüklenemedi' }),
      el('p', { text: err.message })));
  }
  return m;
}
