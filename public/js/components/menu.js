// Small anchored dropdown menu used by post cards, profile actions, etc.
import { el, icon } from '../ui.js';

export function openMenu(anchor, items) {
  document.querySelectorAll('.menu').forEach((m) => m.remove());
  const menu = el('div', { class: 'menu', role: 'menu' });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    menu.remove();
    document.removeEventListener('click', onDoc, true);
  };
  const onDoc = (e) => { if (!menu.contains(e.target)) close(); };
  for (const item of items) {
    if (!item) continue;
    if (item === '-') {
      menu.append(el('div', { class: 'sep' }));
      continue;
    }
    menu.append(el('button', {
      class: item.danger ? 'danger' : '',
      role: 'menuitem',
      onclick: () => {
        close();
        if (item.onClick) item.onClick();
      },
    }, item.iconName ? icon(item.iconName, 18) : null, el('span', { text: item.label })));
  }
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const w = menu.offsetWidth || 210;
  const h = menu.offsetHeight || 150;
  let left = r.right - w;
  if (left < 8) left = 8;
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  setTimeout(() => document.addEventListener('click', onDoc, true), 0);
  return close;
}
