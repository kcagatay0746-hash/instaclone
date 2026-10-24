// Reels page: full-screen, snap-scrolling feed that only plays the visible reel.
import { API } from '../api.js';
import { el, icon, spinner, toast, emptyState, navigate, bus } from '../ui.js';
import { buildReel } from '../components/reel.js';

export async function reelsView() {
  const column = el('div', { class: 'column reels-column' });
  let soundOn = false;

  const soundBtn = el('button', { class: 'btn ghost sm' }, icon('sun', 16), 'Sesi aç');
  const header = el('div', { class: 'reels-header' },
    el('h1', { text: 'Reels' }),
    el('span', { class: 'count-pill', text: 'tam ekran keşfet' }),
    soundBtn);
  const feed = el('div', { class: 'reels' });
  const sentinel = el('div', { class: 'load-more', style: { padding: '14px' } });
  column.append(header, feed, sentinel);

  const players = [];
  let offset = 0;
  let loading = false;
  let done = false;

  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    players.forEach((p) => p.setMuted(!soundOn));
    soundBtn.replaceChildren(icon(soundOn ? 'sun' : 'moon', 16), soundOn ? 'Sesi kapat' : 'Sesi aç');
    toast(soundOn ? 'Ses açık 🔊' : 'Sessize alındı 🔇');
  });

  async function loadMore() {
    if (loading || done) return;
    loading = true;
    sentinel.replaceChildren(spinner());
    try {
      const res = await API.reels(offset);
      if (!res.posts.length) {
        done = true;
        sentinel.replaceChildren();
        if (!feed.children.length) {
          feed.append(el('div', { class: 'reel-empty' }, emptyState('play', 'Reels henüz boş',
            'İlk videonu ya da fotoğrafını paylaş; burada tam ekran görünsün.',
            el('button', { class: 'btn gradient', onclick: () => navigate('/create') }, 'Gönderi oluştur'))));
        }
        return;
      }
      for (const post of res.posts) {
        const player = buildReel(post, { soundOn: () => soundOn });
        players.push(player);
        feed.append(player.node);
        io.observe(player.node);
      }
      offset = res.next === null ? offset : res.next;
      done = res.next === null;
      sentinel.replaceChildren(done ? el('div', { class: 'rail-foot', text: 'Reels sonu ✨' }) : null);
    } catch (err) {
      toast(err.message, 'error');
      sentinel.replaceChildren(el('button', { class: 'btn ghost', onclick: loadMore }, 'Tekrar dene'));
    } finally {
      loading = false;
    }
  }

  // Only the reel filling most of the viewport plays.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const player = players.find((p) => p.node === e.target);
      if (!player) continue;
      if (e.isIntersecting && e.intersectionRatio > 0.6) player.play();
      else player.pause();
    }
  }, { root: feed, threshold: [0, 0.6, 0.9] });

  const loadIo = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) loadMore();
  }, { root: feed, rootMargin: '300px' });
  loadIo.observe(sentinel);

  await loadMore();

  const offDeleted = bus.on('post:deleted', (id) => {
    feed.querySelector(`[data-post-id="${id}"]`)?.remove();
  });

  return {
    node: column,
    wide: true,
    cleanup: () => {
      io.disconnect();
      loadIo.disconnect();
      offDeleted();
      players.forEach((p) => p.pause());
    },
  };
}
