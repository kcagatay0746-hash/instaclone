// Direct messages: conversation list + live thread pane.
import { API } from '../api.js';
import { el, icon, avatar, fmt, spinner, toast, modal, debounce, bus, navigate } from '../ui.js';
import { reloadCounts } from '../store.js';
import { createThreadView } from '../components/thread.js';

function newChatModal() {
  const results = el('div', {});
  const input = el('input', { class: 'input', placeholder: 'Kullanıcı ara…', autocomplete: 'off' });
  const body = el('div', {}, input, results);
  const m = modal({ title: 'Yeni mesaj', size: 'sm', body });
  const run = debounce(async () => {
    const q = input.value.trim();
    if (!q) {
      results.replaceChildren(el('p', { class: 'muted small', text: 'Bir kullanıcı adı yaz.' }));
      return;
    }
    results.replaceChildren(el('div', { class: 'load-more' }, spinner()));
    try {
      const { users } = await API.search(q);
      results.replaceChildren(...(users.length
        ? users.map((u) => el('div', {
          class: 'user-row clickable',
          onclick: () => { m.close(); navigate(`/messages/${u.username}`); },
        }, avatar(u, 42), el('div', { class: 'who' }, el('b', { text: u.username }), el('span', { text: u.name }))))
        : [el('p', { class: 'muted small', text: 'Sonuç yok.' })]));
    } catch (err) {
      results.replaceChildren(el('p', { class: 'form-error', text: err.message }));
    }
  }, 250);
  input.addEventListener('input', run);
  setTimeout(() => input.focus(), 60);
  return m;
}

export async function messagesView(username) {
  const wrap = el('div', { class: 'msgs' });
  const convsEl = el('div', { class: 'convs' });
  const threadEl = el('div', { class: 'thread' });
  const listEl = el('div', { class: 'list' },
    el('div', { class: 'list-head' },
      el('h2', { text: 'Mesajlar' }),
      el('button', { class: 'icon-btn', 'aria-label': 'Yeni mesaj', onclick: newChatModal }, icon('plus', 22))),
    convsEl);
  wrap.append(listEl, threadEl);

  const thread = createThreadView({
    threadEl,
    wrap,
    onBack: () => { thread.placeholder(); loadConvs(); },
    onSent: () => loadConvs(),
  });

  async function loadConvs() {
    try {
      const { conversations } = await API.conversations();
      convsEl.replaceChildren();
      if (!conversations.length) {
        convsEl.append(el('div', { class: 'empty' },
          el('p', { class: 'muted small', text: 'Henüz konuşma yok.' }),
          el('button', { class: 'btn ghost sm', onclick: newChatModal }, 'Sohbet başlat')));
        return;
      }
      for (const c of conversations) {
        convsEl.append(el('div', {
          class: `conv${thread.current() === c.user.username ? ' active' : ''}`,
          onclick: () => {
            if (thread.current() !== c.user.username) navigate(`/messages/${c.user.username}`);
          },
        },
        avatar(c.user, 48),
        el('div', { class: 'who' },
          el('b', { text: c.user.username }),
          el('span', { text: `${c.last.mine ? 'Sen: ' : ''}${c.last.text}` })),
        c.unread
          ? el('span', { class: 'badge', text: String(c.unread) })
          : el('span', { class: 'muted small', text: fmt.time(c.last.created_at) })));
      }
    } catch (err) {
      convsEl.replaceChildren(el('p', { class: 'form-error', text: err.message }));
    }
  }

  loadConvs();
  if (username) await thread.open(username);
  else thread.placeholder();
  await loadConvs();
  reloadCounts();

  const offIncoming = bus.on('dm:incoming', async (data) => {
    if (thread.incoming(data)) await reloadCounts();
    loadConvs();
    void toast;
  });

  // call ended/declined rows are written into the thread by the server
  const offRefresh = bus.on('dm:refresh', () => {
    loadConvs();
    const current = thread.current();
    if (current) thread.open(current);
  });

  return { node: wrap, wide: true, cleanup: () => { offIncoming(); offRefresh(); } };
}
