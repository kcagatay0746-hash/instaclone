// Home feed: stories tray, posts, suggestions rail, infinite scroll.
import { API } from '../api.js';
import { el, icon, avatar, spinner, skeletonPost, toast, bus, navigate } from '../ui.js';
import { state } from '../store.js';
import { postCard } from '../components/post-card.js';
import { followRow } from '../components/user-row.js';
import { openStories } from './stories.js';
import { openStoryComposer } from './story-composer.js';

export async function feedView() {
  const column = el('div', { class: 'column' });
  const page = el('div', { class: 'page' }, column);
  const storiesWrap = el('div', { class: 'stories', id: 'stories' });
  const list = el('div', { class: 'feed-list', style: { display: 'grid', gap: '18px' } });
  const sentinel = el('div', { class: 'load-more' });
  column.append(storiesWrap, list, sentinel);

  let cursor = null;
  let loading = false;
  let exhausted = false;

  async function loadStories() {
    try {
      const { groups } = await API.stories();
      storiesWrap.replaceChildren();
      const mine = groups.find((g) => g.user.id === state.me.id);
      storiesWrap.append(el('div', {
        class: 'story add',
        onclick: () => (mine ? openStories(groups, groups.indexOf(mine)) : openStoryComposer(loadStories)),
        title: 'Hikaye ekle',
      }, el('div', { class: 'wrap' },
        avatar(state.me, 62),
        el('span', { class: 'plus' }, icon('plus', 13))),
      el('span', { class: 'name', text: 'Hikayen' })));
      for (const g of groups) {
        if (g.user.id === state.me.id) continue;
        storiesWrap.append(el('div', {
          class: 'story',
          onclick: () => openStories(groups, groups.indexOf(g)),
        }, el('div', { class: 'wrap' }, avatar(g.user, 62, { ring: true })),
        el('span', { class: 'name', text: g.user.username })));
      }
    } catch {
      storiesWrap.classList.add('hide');
    }
  }

  function suggestionsCard() {
    const card = el('div', { class: 'rail-card' },
      el('div', { class: 'head' }, el('h2', { text: 'Önerilenler' }), el('a', { href: '#/explore' }, 'Tümü')));
    API.suggestions().then(({ users }) => {
      card.append(users.length
        ? el('div', {}, users.slice(0, 5).map((u) => followRow(u)))
        : el('p', { class: 'muted small', text: 'Şimdilik öneri yok.' }));
    }).catch(() => card.append(el('p', { class: 'muted small', text: 'Öneriler yüklenemedi.' })));
    return card;
  }

  function emptyFeedBlock() {
    const card = el('div', { class: 'card pad' },
      el('div', { class: 'section-title' }, el('h2', { text: 'Takip edecek birini bul' })),
      spinner());
    API.suggestions().then(({ users }) => {
      card.replaceChildren(
        el('div', { class: 'section-title' }, el('h2', { text: 'Takip edecek birini bul' })),
        users.length
          ? el('div', {}, users.map((u) => followRow(u)))
          : el('p', { class: 'muted small', text: 'Şimdilik öneri yok.' }),
        el('div', { style: { marginTop: '12px' } },
          el('button', { class: 'btn primary block', onclick: () => navigate('/explore') }, 'Keşfet’e göz at')));
    }).catch(() => {});
    return card;
  }

  function appendPosts(posts) {
    for (const p of posts) {
      list.append(postCard(p, {
        onDeleted: (post) => {
          const n = list.querySelector(`[data-post-id="${post.id}"]`);
          if (n) n.remove();
        },
      }).node);
    }
  }

  async function loadMore() {
    if (loading || exhausted) return;
    loading = true;
    sentinel.replaceChildren(spinner());
    try {
      const res = await API.feed(cursor);
      if (!res.posts.length) {
        exhausted = true;
        if (!list.children.length) list.append(emptyFeedBlock());
        sentinel.replaceChildren();
        return;
      }
      appendPosts(res.posts);
      cursor = res.next;
      if (!cursor) {
        exhausted = true;
        sentinel.replaceChildren(el('div', { class: 'rail-foot', text: 'Tüm gönderileri gördün 🎉' }));
      } else {
        sentinel.replaceChildren();
      }
    } catch (err) {
      sentinel.replaceChildren(el('button', { class: 'btn ghost', onclick: loadMore }, 'Tekrar dene'));
      toast(err.message, 'error');
    } finally {
      loading = false;
    }
  }

  // desktop rail
  const followBack = el('div', { class: 'rail-card hide' },
    el('div', { class: 'head' }, el('h2', { text: 'Seni takip ediyor' })),
    el('div', { class: 'rows' }));
  API.followsMe().then(({ users }) => {
    if (!users.length) return;
    followBack.classList.remove('hide');
    followBack.querySelector('.rows').append(...users.slice(0, 4).map((u) => followRow(u)));
  }).catch(() => {});

  const rail = el('aside', { class: 'rail' },
    el('div', { class: 'rail-card' },
      el('div', { class: 'rail-me' },
        el('a', { href: `#/u/${state.me.username}` }, avatar(state.me, 48)),
        el('div', { class: 'who' },
          el('a', { href: `#/u/${state.me.username}` }, el('b', { text: state.me.username })),
          el('span', { text: state.me.name })),
        el('button', { class: 'btn text sm', onclick: () => import('../store.js').then((s) => s.logout()) }, 'Çıkış'))),
    followBack,
    suggestionsCard(),
    el('div', { class: 'rail-foot' },
      'Hakkında · Yardım · Gizlilik · Şartlar', el('br'), '© 2026 Instaclone — demo proje'));
  page.append(rail);

  loadStories().catch(() => {});
  list.append(skeletonPost(), skeletonPost());
  await loadMore();
  list.querySelectorAll('.skeleton-post').forEach((s) => s.remove());

  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) loadMore();
  }, { rootMargin: '600px 0px' });
  io.observe(sentinel);

  const offStory = bus.on('story:new', loadStories);
  const offDeleted = bus.on('post:deleted', (id) => {
    list.querySelector(`[data-post-id="${id}"]`)?.remove();
  });

  return {
    node: page,
    wide: true,
    cleanup: () => {
      io.disconnect();
      offStory();
      offDeleted();
    },
  };
}
