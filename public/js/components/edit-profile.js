// Edit-profile modal: avatar upload, name, bio + logout.
import { API } from '../api.js';
import { el, icon, avatar, toast, modal, loadImageFile, renderToDataUrl, bus } from '../ui.js';
import { state, logout } from '../store.js';

export function openEditProfile() {
  let avatarData = null;
  let removeAvatar = false;
  const preview = el('div', {});
  const nameInput = el('input', { class: 'input', value: state.me.name, maxlength: '60' });
  const bioInput = el('textarea', { class: 'textarea', maxlength: '300', rows: '3' });
  bioInput.value = state.me.bio || '';
  const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'hide' });
  const error = el('div', { class: 'form-error' });

  const drawPreview = () => {
    const shown = avatarData || (removeAvatar ? null : state.me.avatar);
    preview.replaceChildren(shown
      ? el('span', { class: 'avatar', style: { width: '78px', height: '78px' } }, el('img', { src: shown, alt: '' }))
      : avatar(state.me, 78));
  };
  drawPreview();

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files || !fileInput.files[0]) return;
    try {
      const img = await loadImageFile(fileInput.files[0]);
      avatarData = renderToDataUrl(img, { aspect: 1, maxSize: 320 });
      removeAvatar = false;
      drawPreview();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  const saveBtn = el('button', { class: 'btn primary' }, 'Kaydet');
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Kaydediliyor…';
    error.textContent = '';
    try {
      const patch = { name: nameInput.value, bio: bioInput.value };
      if (avatarData) patch.avatar = avatarData;
      if (removeAvatar) patch.remove_avatar = true;
      const res = await API.updateMe(patch);
      state.me = res.user;
      toast('Profil güncellendi');
      m.close();
      bus.emit('profile:updated', res.user);
      bus.emit('counts', state);
    } catch (err) {
      error.textContent = err.message;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Kaydet';
    }
  });

  const body = el('div', {},
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' } },
      preview,
      el('div', { style: { display: 'grid', gap: '8px' } },
        fileInput,
        el('button', { class: 'btn primary sm', onclick: () => fileInput.click() }, 'Fotoğraf seç'),
        el('button', {
          class: 'btn text sm',
          onclick: () => { avatarData = null; removeAvatar = true; drawPreview(); },
        }, 'Fotoğrafı kaldır'))),
    el('div', { class: 'field' }, el('label', { text: 'Kullanıcı adı' }),
      el('input', { class: 'input', value: state.me.username, disabled: true }),
      el('div', { class: 'hint', text: 'Kullanıcı adı değiştirilemez.' })),
    el('div', { class: 'field' }, el('label', { text: 'Ad Soyad' }), nameInput),
    el('div', { class: 'field' }, el('label', { text: 'Biyografi' }), bioInput),
    error,
    el('div', { style: { display: 'flex', gap: '8px', marginTop: '6px' } },
      el('button', { class: 'btn ghost', style: { flex: '1' }, onclick: () => m.close() }, 'Vazgeç'),
      el('button', { class: 'btn ghost', style: { flex: '1' }, onclick: () => { m.close(); logout(); } }, icon('logout', 18), 'Çıkış yap'),
      saveBtn));

  const m = modal({ title: 'Profili düzenle', size: 'md', body });
  return m;
}
