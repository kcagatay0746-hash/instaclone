// Hashtag page: hero + matching posts.
import { API } from '../api.js';
import { el, icon, spinner, emptyState } from '../ui.js';
import { postGrid } from '../components/grid.js';

export async function tagView(tag) {
  const column = el('div', { class: 'column' });
  const gridWrap = el('div', { class: 'card', style: { padding: '3px' } }, el('div', { class: 'load-more' }, spinner()));
  column.append(
    el('div', { class: 'tag-hero' },
      el('div', { class: 'circle' }, icon('tag', 34)),
      el('div', {},
        el('h1', { text: `#${tag}` }),
        el('p', { text: 'Bu etiketi kullanan gönderiler' }))),
    gridWrap);

  try {
    const res = await API.tag(tag);
    const count = el('p', { text: `${res.posts.length} gönderi` });
    column.querySelector('.tag-hero > div:last-child').append(count);
    gridWrap.replaceChildren(res.posts.length
      ? postGrid(res.posts)
      : el('div', { class: 'card pad' }, emptyState('tag', 'Bu etikette gönderi yok',
        'İlk gönderiyi paylaşan sen ol. Açıklamana bu etiketi eklemen yeterli.')));
  } catch (err) {
    gridWrap.replaceChildren(el('div', { class: 'empty' }, el('h3', { text: 'Etiket yüklenemedi' }), el('p', { text: err.message })));
  }

  return { node: column, wide: true };
}
