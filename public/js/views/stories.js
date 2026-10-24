// Story viewer: progress bars, tap zones, hold to pause, reply via DM.
import { API } from '../api.js';
import { el, icon, avatar, fmt, toast, bus } from '../ui.js';
import { state } from '../store.js';

const DURATION = 5000;

export function openStories(groups, startGroup = 0) {
  if (!groups || !groups.length) return null;
  const root = document.getElementById('overlay-root');
  let gi = Math.max(0, Math.min(startGroup, groups.length - 1));
  let si = 0;
  let running = false;
  let remaining = DURATION;
  let startAt = 0;
  let timer = null;

  const img = el('img', { class: 'sv-img', alt: 'Hikaye' });
  const bars = el('div', { class: 'sv-bars' });
  const who = el('div', { class: 'sv-user' });
  const bottom = el('div', { class: 'sv-bottom' });
  const card = el('div', { class: 'sv-card' }, img,
    el('div', { class: 'sv-top' }, bars, who),
    el('div', { class: 'sv-zone prev', onclick: () => prevStory() }),
    el('div', { class: 'sv-zone next', onclick: () => nextStory() }),
    el('div', { class: 'sv-hint', text: 'Dokun: ileri · Basılı tut: duraklat' }),
    bottom);
  const wrap = el('div', { class: 'sv', role: 'dialog', 'aria-modal': 'true' }, card);
  root.append(wrap);
  document.body.classList.add('modal-open');

  function close() {
    stop();
    wrap.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') nextStory();
    if (e.key === 'ArrowLeft') prevStory();
  }
  document.addEventListener('keydown', onKey);

  function drawBars() {
    const g = groups[gi];
    bars.replaceChildren();
    g.stories.forEach((s, i) => {
      const inner = el('i');
      if (i < si) inner.style.width = '100%';
      bars.append(el('div', { class: `sv-bar${i < si ? ' done' : ''}` }, inner));
    });
  }

  function startBar() {
    const inner = bars.children[si] && bars.children[si].firstElementChild;
    if (!inner || running) return;
    inner.style.transition = `width ${remaining}ms linear`;
    void inner.offsetWidth;
    inner.style.width = '100%';
    startAt = performance.now();
    running = true;
    clearTimeout(timer);
    timer = setTimeout(nextInGroup, remaining);
  }

  function pause() {
    if (!running) return;
    running = false;
    clearTimeout(timer);
    const inner = bars.children[si] && bars.children[si].firstElementChild;
    remaining = Math.max(200, remaining - (performance.now() - startAt));
    if (inner) {
      inner.style.transition = 'none';
      inner.style.width = `${((DURATION - remaining) / DURATION) * 100}%`;
    }
  }

  function resume() {
    startBar();
  }

  function stop() {
    running = false;
    clearTimeout(timer);
  }

  function nextInGroup() {
    const g = groups[gi];
    if (si + 1 < g.stories.length) {
      si += 1;
      show();
    } else if (gi + 1 < groups.length) {
      gi += 1;
      si = 0;
      show();
    } else {
      close();
    }
  }

  function prevInGroup() {
    if (si > 0) {
      si -= 1;
      show();
    } else if (gi > 0) {
      gi -= 1;
      si = 0;
      show();
    } else {
      show();
    }
  }
  const nextStory = nextInGroup;
  const prevStory = prevInGroup;

  async function show() {
    stop();
    remaining = DURATION;
    const g = groups[gi];
    const s = g.stories[si];
    img.src = s.image;
    drawBars();
    who.replaceChildren(
      avatar(g.user, 34),
      el('div', {}, el('div', { class: 'name', text: g.user.username }), el('div', { class: 'time', text: fmt.time(s.created_at) })),
      el('div', { class: 'sp' }),
      g.user.id === state.me.id
        ? el('button', {
          class: 'icon-btn sv-close',
          'aria-label': 'Hikayeyi sil',
          onclick: async (e) => {
            e.stopPropagation();
            try {
              await API.deleteStory(s.id);
              toast('Hikaye silindi');
              g.stories.splice(si, 1);
              if (!g.stories.length) {
                groups.splice(gi, 1);
                gi = Math.min(gi, groups.length - 1);
                si = 0;
                if (!groups.length) return close();
              } else if (si >= g.stories.length) {
                si = g.stories.length - 1;
              }
              show();
              bus.emit('story:changed');
            } catch (err) {
              toast(err.message, 'error');
            }
          },
        }, icon('trash', 20))
        : null,
      el('button', { class: 'icon-btn sv-close', 'aria-label': 'Kapat', onclick: close }, icon('close', 22)));

    bottom.replaceChildren();
    if (g.user.id !== state.me.id) {
      const reply = el('input', { placeholder: `${g.user.username} kişisine yanıt ver…` });
      bottom.append(el('form', {
        style: { flex: '1', display: 'flex', gap: '8px' },
        onsubmit: async (e) => {
          e.preventDefault();
          const text = reply.value.trim();
          if (!text) return;
          reply.value = '';
          try {
            await API.sendMessage(g.user.username, text);
            toast('Yanıt gönderildi');
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      }, reply, el('button', { class: 'icon-btn sv-close', type: 'submit', 'aria-label': 'Gönder' }, icon('send', 22))));
      const likeBtn = el('button', { class: 'icon-btn sv-close', 'aria-label': 'Beğen' }, icon('heart', 26));
      likeBtn.addEventListener('click', () => {
        likeBtn.replaceChildren(icon('heartFill', 26));
        toast('Hikaye beğenildi');
      });
      bottom.append(likeBtn);
    }

    s.seen = true;
    if (s.id) API.viewStory(s.id).catch(() => {});
    img.addEventListener('error', () => startBar(), { once: true });
    if (img.complete) startBar();
    else img.addEventListener('load', startBar, { once: true });
  }

  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input, button, form')) return;
    pause();
  });
  card.addEventListener('pointerup', resume);
  card.addEventListener('pointerleave', resume);
  card.addEventListener('pointercancel', resume);

  show();
  return { close };
}

