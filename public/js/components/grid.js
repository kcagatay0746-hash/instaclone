// Square thumbnail grid shared by profile, explore, tag and saved pages.
import { el, icon, fmt } from '../ui.js';
import { openPost } from './post-detail.js';

export function gridItem(post, onOpen = openPost) {
  return el('div', {
    class: 'grid-item',
    role: 'button',
    tabindex: '0',
    'aria-label': `Gönderi: ${post.caption || post.user.username}`,
    onclick: () => onOpen(post.id),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(post.id); } },
  },
  el('img', { src: post.image, alt: post.caption || 'Gönderi', loading: 'lazy' }),
  el('div', { class: 'over' },
    el('span', {}, icon('heartFill', 18), fmt.count(post.likes)),
    el('span', {}, icon('comment', 18), fmt.count(post.comments))));
}

export function postGrid(posts, { onOpen, empty } = {}) {
  if (!posts.length && empty) return el('div', { class: 'card pad' }, empty);
  return el('div', { class: 'grid' }, posts.map((p) => gridItem(p, onOpen)));
}
