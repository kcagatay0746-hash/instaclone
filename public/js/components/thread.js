// Single DM thread renderer, mounted inside the messages layout.
import { API } from '../api.js';
import { el, icon, avatar, fmt, spinner, toast, emptyState, navigate } from '../ui.js';

export function createThreadView({ threadEl, wrap, onBack, onSent }) {
  let name = null;
  let appending = null;

  function placeholder() {
    name = null;
    appending = null;
    threadEl.replaceChildren(emptyState('message', 'Mesajların',
      'Bir konuşma seç veya yeni bir sohbet başlat. Mesajlar anında iletilir.'));
    wrap.classList.remove('show-thread');
  }

  async function open(username) {
    name = username;
    wrap.classList.add('show-thread');
    threadEl.replaceChildren(el('div', { class: 'load-more' }, spinner()));
    try {
      const res = await API.thread(username);
      const bubbles = el('div', { class: 'bubbles' });
      const paint = (messages) => {
        bubbles.replaceChildren();
        if (!messages.length) {
          bubbles.append(emptyState('send', 'İlk mesajı sen at', `${username} ile sohbeti başlat.`));
        }
        let lastTs = 0;
        for (const msg of messages) {
          if (msg.created_at - lastTs > 30 * 60 * 1000) {
            bubbles.append(el('div', { class: 'bubble-time', text: fmt.time(msg.created_at) }));
          }
          lastTs = msg.created_at;
          bubbles.append(el('div', { class: `bubble${msg.mine ? ' mine' : ''}`, text: msg.text }));
        }
        requestAnimationFrame(() => { bubbles.scrollTop = bubbles.scrollHeight; });
      };
      paint(res.messages);

      const input = el('input', { placeholder: 'Mesaj yaz…', maxlength: '2000', 'aria-label': 'Mesaj' });
      const form = el('form', {
        class: 'composer',
        onsubmit: async (e) => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text) return;
          input.value = '';
          const optimistic = el('div', { class: 'bubble mine', text });
          bubbles.querySelector('.empty')?.remove();
          bubbles.append(optimistic);
          bubbles.scrollTop = bubbles.scrollHeight;
          try {
            await API.sendMessage(username, text);
            if (onSent) onSent(username);
          } catch (err) {
            optimistic.classList.add('muted');
            toast(err.message, 'error');
          }
        },
      }, input, el('button', { class: 'icon-btn', type: 'submit', 'aria-label': 'Gönder' }, icon('send', 24)));

      const header = el('div', { class: 'thread-head' },
        el('button', {
          class: 'icon-btn mobile-only',
          'aria-label': 'Geri',
          onclick: () => { if (onBack) onBack(); },
        }, icon('left', 22)),
        el('a', { href: `#/u/${res.user.username}` }, avatar(res.user, 40)),
        el('a', { class: 'who', href: `#/u/${res.user.username}` },
          el('b', { text: res.user.username }), el('span', { text: res.user.name })),
        el('button', {
          class: 'icon-btn', 'aria-label': 'Profili aç',
          onclick: () => navigate(`/u/${res.user.username}`),
        }, icon('user', 22)));

      threadEl.replaceChildren(header, bubbles, form);
      appending = (msg) => {
        bubbles.querySelector('.empty')?.remove();
        bubbles.append(el('div', { class: 'bubble', text: msg.text }));
        bubbles.scrollTop = bubbles.scrollHeight;
      };
      input.focus();
    } catch (err) {
      threadEl.replaceChildren(el('div', { class: 'empty' },
        el('h3', { text: 'Sohbet açılamadı' }),
        el('p', { text: err.message }),
        el('button', { class: 'btn ghost', onclick: () => open(username) }, 'Tekrar dene')));
    }
  }

  function incoming(data) {
    if (name && data && data.from === name && appending) appending(data.message);
    return name && data && data.from === name;
  }

  return { open, placeholder, incoming, current: () => name };
}
