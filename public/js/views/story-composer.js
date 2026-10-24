// Story composer: pick an image, crop to 9:16, publish.
import { API } from '../api.js';
import { el, icon, toast, modal, loadImageFile, renderToDataUrl, bus } from '../ui.js';

export function openStoryComposer(onDone) {
  const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'hide' });
  const body = el('div', {});
  const m = modal({ title: 'Hikayene ekle', size: 'md', body });
  let dataUrl = null;

  const pick = el('div', { class: 'dropzone' },
    el('div', { class: 'empty-ic' }, icon('image', 34)),
    el('h3', { text: 'Bir fotoğraf seç' }),
    el('p', { text: 'Dikey (9:16) olarak kırpılır. En fazla 20MB.' }),
    el('button', { class: 'btn primary', onclick: () => fileInput.click() }, 'Fotoğraf seç'));

  const shareBtn = el('button', { class: 'btn gradient block' }, 'Hikayede paylaş');
  const preview = el('div', { class: 'compose' },
    el('div', { class: 'preview' }, el('div', { class: 'frame story' }, el('img', { alt: 'Önizleme' }))),
    el('div', { class: 'panel' },
      el('div', { class: 'panel-scroll' },
        el('p', { class: 'muted', text: 'Hikayen 24 saat boyunca takipçilerine görünür.' }),
        el('p', { class: 'hint', text: 'İpucu: Hikayene yanıt gelen mesajlar DM kutunda görünür.' })),
      el('div', { class: 'foot' },
        shareBtn,
        el('button', { class: 'btn ghost block', onclick: () => { body.replaceChildren(pick); dataUrl = null; } }, 'Başka fotoğraf seç'))));
  preview.classList.add('hide');
  body.append(pick, fileInput, preview);

  shareBtn.addEventListener('click', async () => {
    if (!dataUrl) return;
    shareBtn.disabled = true;
    shareBtn.textContent = 'Paylaşılıyor…';
    try {
      await API.addStory(dataUrl);
      toast('Hikayen paylaşıldı');
      m.close();
      bus.emit('story:new');
      if (onDone) onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      shareBtn.disabled = false;
      shareBtn.textContent = 'Hikayede paylaş';
    }
  });

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files || !fileInput.files[0]) return;
    try {
      const img = await loadImageFile(fileInput.files[0]);
      dataUrl = renderToDataUrl(img, { aspect: 9 / 16, maxSize: 1080 });
      preview.querySelector('.frame img').src = dataUrl;
      pick.classList.add('hide');
      preview.classList.remove('hide');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  return m;
}
