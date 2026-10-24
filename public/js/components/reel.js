// One full-screen reel: media, overlay meta, like/comment/share/save rail.
import { API } from '../api.js';
import { el, icon, avatar, fmt, linkify, toast, navigate } from '../ui.js';
import { postMedia } from './media.js';
import { openPost } from './post-detail.js';
import { state } from '../store.js';

function actionButton(iconName, label, onClick) {
  return el('button', { class: 'reel-action', 'aria-label': label, onclick: onClick },
    icon(iconName, 26), el('span', { class: 'reel-action-label', text: label }));
}

export function buildReel(post, { soundOn = () => false } = {}) {
  const isVideo = post.kind === 'video' && !!post.video;
  const media = postMedia(post, { controls: false, autoplay: isVideo, muted: true, loop: true, className: 'reel-media' });
  const likesEl = el('span', { text: fmt.count(post.likes) });
  const viewsEl = el('span', { text: fmt.count(post.views || 0) });

  const likeBtn = actionButton(post.liked ? 'heartFill' : 'heart', fmt.count(post.likes), async () => {
    const on = !post.liked;
    post.liked = on;
    post.likes += on ? 1 : -1;
    paintLike();
    try {
      const res = await API.like(post.id, on);
      post.likes = res.post.likes;
      post.liked = res.post.liked;
    } catch (err) {
      post.liked = !on;
      post.likes += on ? -1 : 1;
      toast(err.message, 'error');
    }
    paintLike();
  });
  const paintLike = () => {
    likeBtn.replaceChildren(icon(post.liked ? 'heartFill' : 'heart', 26),
      el('span', { class: 'reel-action-label', text: fmt.count(post.likes) }));
    likeBtn.classList.toggle('liked', post.liked);
    likesEl.textContent = fmt.count(post.likes);
  };
  paintLike();

  const saveBtn = actionButton(post.saved ? 'bookmarkFill' : 'bookmark', post.saved ? 'Kaydedildi' : 'Kaydet', async () => {
    const on = !post.saved;
    post.saved = on;
    saveBtn.replaceChildren(icon(post.saved ? 'bookmarkFill' : 'bookmark', 26),
      el('span', { class: 'reel-action-label', text: post.saved ? 'Kaydedildi' : 'Kaydet' }));
    saveBtn.classList.toggle('liked', post.saved);
    try {
      await API.save(post.id, on);
      toast(on ? 'Kaydedildi' : 'Kaydedilenlerden çıkarıldı');
    } catch (err) {
      post.saved = !on;
      toast(err.message, 'error');
    }
  });
  if (post.saved) saveBtn.classList.add('liked');

  const followBtn = el('button', { class: 'btn primary sm hide' }, 'Takip et');
  if (post.user.id !== state.me.id) {
    API.user(post.user.username).then(({ user }) => {
      let following = user.is_following;
      followBtn.classList.remove('hide');
      followBtn.textContent = following ? 'Takiptesin' : 'Takip et';
      followBtn.className = `btn sm ${following ? 'ghost' : 'primary'}`;
      followBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const res = await API.follow(post.user.username, !following);
          following = res.user.is_following;
          followBtn.textContent = following ? 'Takiptesin' : 'Takip et';
          followBtn.className = `btn sm ${following ? 'ghost' : 'primary'}`;
          toast(following ? `${post.user.username} takip edildi` : 'Takipten çıkarıldı');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    }).catch(() => {});
  }

  const node = el('article', { class: 'reel', 'data-post-id': String(post.id) },
    el('div', { class: 'reel-media-wrap' }, media),
    el('div', { class: 'reel-shade' }),
    el('div', { class: 'reel-top' },
      el('span', { class: 'reel-title' }, 'Reels'),
      el('button', { class: 'icon-btn reel-icon', 'aria-label': 'Akışa dön', onclick: () => navigate('/feed') }, icon('close', 22))),
    el('div', { class: 'reel-bottom' },
      el('div', { class: 'reel-user' },
        el('a', { href: `#/u/${post.user.username}` }, avatar(post.user, 40)),
        el('a', { class: 'reel-username', href: `#/u/${post.user.username}` }, post.user.username),
        followBtn),
      post.caption ? el('div', { class: 'reel-caption' }, linkify(post.caption)) : null,
      el('div', { class: 'reel-meta' },
        el('span', {}, icon('play', 13), ` ${fmt.count(post.views || 0)}`),
        el('span', { class: 'muted', text: fmt.time(post.created_at) }))),
    el('div', { class: 'reel-actions' },
      likeBtn,
      actionButton('comment', fmt.count(post.comments), () => openPost(post.id)),
      actionButton('send', 'Paylaş', () => {
        navigator.clipboard?.writeText(`${location.origin}/#/p/${post.id}`);
        toast('Bağlantı kopyalandı');
      }),
      saveBtn,
      el('div', { class: 'reel-stats' },
        el('div', { class: 'reel-stat' }, icon('heartFill', 18), likesEl),
        el('div', { class: 'reel-stat' }, icon('play', 16), viewsEl))));

  let lastTap = 0;
  node.querySelector('.reel-media-wrap').addEventListener('click', () => {
    const now = Date.now();
    if (now - lastTap < 320) likeBtn.click();
    lastTap = now;
  });

  let seen = false;
  return {
    node,
    play() {
      if (isVideo) {
        media.muted = !soundOn();
        media.play?.().catch(() => {});
      }
      node.classList.add('playing');
      if (!seen) {
        seen = true;
        API.viewPost(post.id).then((r) => {
          post.views = r.views;
          viewsEl.textContent = fmt.count(post.views);
        }).catch(() => {});
      }
    },
    pause() {
      if (isVideo) media.pause?.();
      node.classList.remove('playing');
    },
    setMuted(m) {
      if (isVideo) media.muted = m;
    },
  };
}
