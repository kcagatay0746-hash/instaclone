// Explore: ranked grid of posts from people you don't follow yet.
import { API } from '../api.js';
import { el, spinner, toast, emptyState } from '../ui.js';
import { gridItem } from '../components/grid.js';

export async function exploreView() {
  const column = el('div', { class: 'column' });
  const grid = el('div', { class: 'grid' });
  const sentinel = el('div', { class: 'load-more' }, spinner());
  column.append(
    el('div', { class: 'page-title-row' }, el('h1', { text: 'Keşfet' }), el('span', { class: 'count-pill', text: 'sana özel' })),
    el('div', { class: 'card', style: { padding: '3px' } }, grid),
    sentinel);

  let offset = 0;
  let loading = false;
  let done = false;

  async function load() {
    if (loading || done) return;
    loading = true;
    try {
      const res = await API.explore(offset);
      for (const p of res.posts) grid.append(gridItem(p));
      if (res.next === null) {
        done = true;
        sentinel.replaceChildren(el('div', { class: 'rail-foot', text: 'Keşfetin sonuna geldin ✨' }));
        if (!grid.children.length) {
          column.querySelector('.card').replaceChildren(emptyState('compass', 'Henüz keşfedilecek bir şey yok', 'Birkaç gönderi paylaşınca burada görünecek.'));
        }
      } else {
        offset = res.next;
        sentinel.replaceChildren();
      }
    } catch (err) {
      toast(err.message, 'error');
      sentinel.replaceChildren(el('button', { class: 'btn ghost', onclick: load }, 'Tekrar dene'));
    } finally {
      loading = false;
    }
  }

  await load();
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) load();
  }, { rootMargin: '500px' });
  io.observe(sentinel);

  return { node: column, wide: true, cleanup: () => io.disconnect() };
}
