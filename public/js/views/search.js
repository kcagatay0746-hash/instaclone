// Search users + hashtags, with recent searches and an explore fallback.
import { API } from '../api.js';
import { el, icon, spinner, debounce, navigate } from '../ui.js';
import { followRow } from '../components/user-row.js';

const RECENT_KEY = 'recent-searches';

function recentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}
function pushRecent(term) {
  const list = [term, ...recentSearches().filter((t) => t !== term)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export async function searchView() {
  const column = el('div', { class: 'column' });
  const results = el('div', {});
  const input = el('input', { placeholder: 'Kullanıcı veya #etiket ara…', 'aria-label': 'Ara', autocomplete: 'off' });
  column.append(
    el('div', { class: 'search-wrap' }, icon('search', 20), input),
    results);

  const emptyPrompt = () => {
    const recents = recentSearches();
    results.replaceChildren();
    if (recents.length) {
      results.append(el('div', { class: 'result-group' },
        el('div', { class: 'section-title' }, el('h4', { text: 'Son aramalar' }),
          el('button', { class: 'btn text sm', onclick: () => { localStorage.removeItem(RECENT_KEY); emptyPrompt(); } }, 'Temizle')),
        el('div', { class: 'chips' }, recents.map((t) => el('button', {
          class: 'chip',
          onclick: () => { input.value = t; run(); },
        }, t.startsWith('#') ? t : `@${t}`)))));
    }
    const trend = el('div', { class: 'result-group' },
      el('h4', { text: 'Öne çıkan etiketler' }),
      el('div', { class: 'chips' },
        ['photography', 'istanbul', 'food', 'music', 'doğa', 'design'].map((t) => el('button', {
          class: 'chip',
          onclick: () => { input.value = `#${t}`; run(); },
        }, `#${t}`))));
    results.append(trend);
  };

  const run = debounce(async () => {
    const term = input.value.trim();
    if (!term) {
      emptyPrompt();
      return;
    }
    results.replaceChildren(el('div', { class: 'load-more' }, spinner()));
    try {
      const { users, tags } = await API.search(term);
      results.replaceChildren();
      if (!users.length && !tags.length) {
        results.append(el('div', { class: 'empty' },
          el('div', { class: 'empty-ic' }, icon('search', 34)),
          el('h3', { text: 'Sonuç bulunamadı' }),
          el('p', { text: `“${term}” için kullanıcı veya etiket yok.` })));
        return;
      }
      if (users.length) {
        results.append(el('div', { class: 'result-group' },
          el('h4', { text: 'Kullanıcılar' }),
          el('div', {}, users.map((u) => followRow(u, { subtitle: u.name })))));
      }
      if (tags.length) {
        results.append(el('div', { class: 'result-group' },
          el('h4', { text: 'Etiketler' }),
          el('div', {}, tags.map((t) => el('div', {
            class: 'tag-row',
            onclick: () => { pushRecent(`#${t.tag}`); navigate(`/tag/${encodeURIComponent(t.tag)}`); },
          },
          el('div', { class: 'circle' }, icon('tag', 20)),
          el('div', {}, el('b', { text: `#${t.tag}` }), el('span', { text: `${t.posts} gönderi` })))))));
      }
    } catch (err) {
      results.replaceChildren(el('p', { class: 'form-error', text: err.message }));
    }
  }, 280);

  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) pushRecent(input.value.trim());
  });
  emptyPrompt();
  setTimeout(() => input.focus(), 60);
  return { node: column };
}
