// User list row with a follow/unfollow button.
import { API } from '../api.js';
import { el, avatar, toast, bus } from '../ui.js';

export function followRow(user, { subtitle, size = 42, onChange, showFollow = true } = {}) {
  let following = !!user.is_following;
  const btn = el('button', { class: following ? 'btn ghost sm' : 'btn primary sm' }, following ? 'Takip ediliyor' : 'Takip et');
  const sync = () => {
    btn.textContent = following ? 'Takip ediliyor' : 'Takip et';
    btn.className = following ? 'btn ghost sm' : 'btn primary sm';
  };
  if (user.is_me || !showFollow) btn.classList.add('hide');
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    btn.disabled = true;
    const next = !following;
    try {
      const res = await API.follow(user.username, next);
      following = res.user.is_following;
      sync();
      toast(next ? `${user.username} takip edildi` : `${user.username} takipten çıkarıldı`);
      bus.emit('follow:changed', { username: user.username, following });
      if (onChange) onChange(following, res.user);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  return el('div', { class: 'user-row clickable', onclick: () => { location.hash = `#/u/${user.username}`; } },
    avatar(user, size),
    el('div', { class: 'who' },
      el('b', { text: user.username }),
      el('span', { text: subtitle || user.name || '' })),
    btn);
}
