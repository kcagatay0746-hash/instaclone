// Saved posts collection.
import { API } from '../api.js';
import { el, spinner, emptyState, navigate, bus } from '../ui.js';
import { postGrid } from '../components/grid.js';

export async function savedView() {
  const column = el('div', { class: 'column' });
  const grid = el('div', { class: 'card', style: { padding: '3px' } }, el('div', { class: 'load-more' }, spinner()));
  column.append(
    el('div', { class: 'page-title-row' }, el('h1', { text: 'Kaydedilenler' }), el('span', { class: 'count-pill', text: 'yalnızca sen görürsün' })),
    grid);

  async function load() {
    try {
      const { posts } = await API.saved();
      grid.replaceChildren(posts.length
        ? postGrid(posts)
        : el('div', { class: 'card pad' }, emptyState('bookmark', 'Henüz kaydedilen yok',
          'Beğendiğin gönderilerin altındaki kaydet ikonuna dokun.',
          el('button', { class: 'btn primary', onclick: () => navigate('/explore') }, 'Keşfet’e göz at'))));
    } catch (err) {
      grid.replaceChildren(el('p', { class: 'form-error', text: err.message }));
    }
  }

  await load();
  const off = bus.on('post:deleted', load);
  return { node: column, wide: true, cleanup: off };
}
