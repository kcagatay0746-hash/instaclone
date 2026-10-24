// Standalone post page (#/p/:id) — also reachable by direct link.
import { API } from '../api.js';
import { el, icon, spinner, navigate } from '../ui.js';
import { postDetailNode } from '../components/post-detail.js';

export async function postView(id) {
  const wrap = el('div', {});
  wrap.append(el('button', { class: 'btn ghost sm', style: { marginBottom: '14px' }, onclick: () => navigate('/feed') },
    icon('left', 16), 'Geri'));
  const holder = el('div', { class: 'card', style: { overflow: 'hidden' } }, el('div', { class: 'load-more' }, spinner()));
  wrap.append(holder);
  try {
    const [{ post }, { comments }] = await Promise.all([API.post(Number(id)), API.comments(Number(id))]);
    holder.replaceChildren(postDetailNode(post, comments, { onDeleted: () => navigate('/feed') }));
  } catch (err) {
    holder.replaceChildren(el('div', { class: 'empty' },
      el('h3', { text: 'Gönderi bulunamadı' }),
      el('p', { text: err.message }),
      el('button', { class: 'btn primary', onclick: () => navigate('/feed') }, 'Ana sayfaya dön')));
  }
  return { node: wrap, wide: true };
}
